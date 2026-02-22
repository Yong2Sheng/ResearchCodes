from pathlib import Path
import numpy as np
import pandas as pd
import tables as tb

import astropy.units as u
from astropy.coordinates import SkyCoord
from tqdm.notebook import tqdm
from astropy_healpix import HEALPix

class APASSDR10Column(tb.IsDescription):
    id_name = tb.StringCol(16, pos = 0)

    ra = tb.Float32Col(pos = 1)      # degree
    ra_err = tb.Float32Col(pos = 2)  # arcsec
    dec = tb.Float32Col(pos = 3)     # degree
    dec_err = tb.Float32Col(pos = 4) # arcsec

    mag_B = tb.Float32Col(pos=5)
    mag_V = tb.Float32Col(pos=6)
    mag_u = tb.Float32Col(pos=7)
    mag_g = tb.Float32Col(pos=8)
    mag_r = tb.Float32Col(pos=9)
    mag_i = tb.Float32Col(pos=10)
    mag_PanSTARRS_zs = tb.Float32Col(pos=11)  # z_s placed on Sloan z′ system
    mag_PanSTARRS_Y = tb.Float32Col(pos=12)

    emag_B = tb.Float32Col(pos=13)
    emag_V = tb.Float32Col(pos=14)
    emag_u = tb.Float32Col(pos=15)
    emag_g = tb.Float32Col(pos=16)
    emag_r = tb.Float32Col(pos=17)
    emag_i = tb.Float32Col(pos=18)
    emag_PanSTARRS_zs = tb.Float32Col(pos=19)
    emag_PanSTARRS_Y = tb.Float32Col(pos=20)

    ipix = tb.Int32Col(pos=21)
    bucket = tb.Int32Col(pos=22)

def count_lines_fast(path, block_size=1024 * 1024):
    # 返回总行数（包含第一行说明 header）
    n = 0
    with open(path, "rb") as f:
        while True:
            b = f.read(block_size)
            if not b:
                break
            n += b.count(b"\n")
    return n

def build_apass_h5(
    text_path: str | Path | list[str | Path],
    h5_path: str | Path,
    nside: int,
    bucket_size: int,
    *,
    order: str = "nested",
    chunksize: int = 1_000_000,
) -> None:
    """
    Stream-ingest an APASS DR10 text catalog into a PyTables HDF5 table.

    Reads the input text file in pandas chunks, computes HEALPix `ipix` and a
    coarse `bucket` id, and appends rows to an HDF5 table. Writes a column
    named `mag_PanSTARRS_Y` / `emag_PanSTARRS_Y` for the APASS Y band.

    It will delete the h5 file if it already exists.

    Parameters
    ----------
    text_path : str, pathlib.Path, or list
        Path to the APASS DR10 plain-text catalog (whitespace-separated, with
        a header line).
    h5_path : str or pathlib.Path
        Output HDF5 file path. If it exists, it will be overwritten.
    nside : int
        HEALPix NSIDE used to compute `ipix`.
    bucket_size : int
        Bucket id is computed as `bucket = ipix // bucket_size`.
    order : {"nested", "ring"}, optional
        HEALPix ordering scheme. Default is "nested".
    chunksize : int, optional
        Number of rows per pandas chunk.

    Returns
    -------
    None
    """

    if not isinstance(text_path, list):
        text_path = [text_path]
    h5_path = Path(h5_path)

    if bucket_size <= 0:
        raise ValueError("bucket_size must be > 0.")

    if h5_path.exists():
        h5_path.unlink()

    hp = HEALPix(nside = nside, order = order, frame = "icrs")

    # This line is setting "storage filters" for the PyTables/HDF5
    # dataset (table/array): compression, (optional) byte order
    # shuffling, checksum, etc. Once you pass it to
    # create_table(..., filters=filters) later, the data written
    # will be stored on disk according to these rules, which helps
    # save space and speed up I/O (often making reads faster as well).
    filters = tb.Filters(complevel=5, complib="blosc:zstd", shuffle=True)
    # shuffle： 在压缩前把每个元素的字节重新排列，让相似字节靠在一起，通常能显著提高压缩比
    #（对数值型列特别有效）。只有在启用压缩时才能用

    with tb.open_file(h5_path, mode = "w") as h5:
        group = h5.create_group("/", "apass", "APASS catalogs")
        table =  h5.create_table(
            group, "dr10",
            APASSDR10Column,
            "APASS DR10 (stream-ingested)",
            filters = filters
        )

        table.attrs.ra_unit = "deg"
        table.attrs.dec_unit = "deg"
        table.attrs.ra_err_unit = "arcsec"
        table.attrs.dec_err_unit = "arcsec"
        table.attrs.mag_system = {"Johnson_BV": "Vega", "SDSS_ugri": "AB", "PanSTARRS_zsY": "AB"}
        table.attrs.nside = int(nside)
        table.attrs.order = str(order)
        table.attrs.bucket_size = int(bucket_size)

        for text_file in tqdm(
            text_path,
            desc="APASS files",
            total=len(text_path),
            position=0,
            leave=True
        ):

            text_file = Path(text_file)

            # count number of lines, note we need to remove the header line
            n_lines = count_lines_fast(text_file)
            nrows = max(n_lines - 1, 0)
            # calculate the total chunks for tqdm progress bar
            total_chunks = math.ceil(nrows / chunksize) if nrows else 0

            # text catalog column names
            colnames = [
                "id_name", "ra", "ra_err", "dec", "dec_err",
                # nobs 8个
                "nobs_B","nobs_V","nobs_u","nobs_g","nobs_r","nobs_i","nobs_PanSTARRS_zs","nobs_PanSTARRS_Y",
                # mag 8个
                "mag_B","mag_V","mag_u","mag_g","mag_r","mag_i","mag_PanSTARRS_zs","mag_PanSTARRS_Y",
                # emag 8个
                "emag_B","emag_V","emag_u","emag_g","emag_r","emag_i","emag_PanSTARRS_zs","emag_PanSTARRS_Y",
            ]

            reader = pd.read_csv(
                text_file,
                sep=r"\s+",
                engine="python",
                header=None,
                names=colnames,
                skiprows=1,
                chunksize=chunksize,
            )

            # read the text file in trunks
            for chunk in tqdm(
                reader,
                desc="chunks",
                total=total_chunks,
                position=1,
                leave=False,
                dynamic_ncols=True,
                mininterval=0.1,
                miniters=1
            ):

                # --- compute ipix/bucket
                ra = chunk["ra"].to_numpy(dtype=float) * u.deg
                dec = chunk["dec"].to_numpy(dtype=float) * u.deg
                sc = SkyCoord(ra=ra, dec=dec, frame="icrs")

                ipix = hp.lonlat_to_healpix(sc.ra, sc.dec).astype(np.int32)
                bucket = (ipix // int(bucket_size)).astype(np.int32)

                out = np.empty(len(chunk), dtype=table.dtype)

                out["id_name"] = chunk["id_name"].astype(str).to_numpy()

                out["ra"] = chunk["ra"].to_numpy(dtype=np.float32)
                out["ra_err"] = chunk["ra_err"].to_numpy(dtype=np.float32)
                out["dec"] = chunk["dec"].to_numpy(dtype=np.float32)
                out["dec_err"] = chunk["dec_err"].to_numpy(dtype=np.float32)

                # If your text file uses different column names, rename the DataFrame
                # before calling build_apass_h5.
                out["mag_B"] = chunk["mag_B"].to_numpy(dtype=np.float32)
                out["mag_V"] = chunk["mag_V"].to_numpy(dtype=np.float32)
                out["mag_u"] = chunk["mag_u"].to_numpy(dtype=np.float32)
                out["mag_g"] = chunk["mag_g"].to_numpy(dtype=np.float32)
                out["mag_r"] = chunk["mag_r"].to_numpy(dtype=np.float32)
                out["mag_i"] = chunk["mag_i"].to_numpy(dtype=np.float32)
                out["mag_PanSTARRS_zs"] = chunk["mag_PanSTARRS_zs"].to_numpy(dtype=np.float32)

                # --- Y renamed here
                out["mag_PanSTARRS_Y"] = chunk["mag_PanSTARRS_Y"].to_numpy(dtype=np.float32)

                out["emag_B"] = chunk["emag_B"].to_numpy(dtype=np.float32)
                out["emag_V"] = chunk["emag_V"].to_numpy(dtype=np.float32)
                out["emag_u"] = chunk["emag_u"].to_numpy(dtype=np.float32)
                out["emag_g"] = chunk["emag_g"].to_numpy(dtype=np.float32)
                out["emag_r"] = chunk["emag_r"].to_numpy(dtype=np.float32)
                out["emag_i"] = chunk["emag_i"].to_numpy(dtype=np.float32)
                out["emag_PanSTARRS_zs"] = chunk["emag_PanSTARRS_zs"].to_numpy(dtype=np.float32)

                # --- Y renamed here
                out["emag_PanSTARRS_Y"] = chunk["emag_PanSTARRS_Y"].to_numpy(dtype=np.float32)

                out["ipix"] = ipix
                out["bucket"] = bucket

                table.append(out)
            table.flush()

        table.cols.bucket.create_index()
        table.cols.ipix.create_index()
        table.flush()
