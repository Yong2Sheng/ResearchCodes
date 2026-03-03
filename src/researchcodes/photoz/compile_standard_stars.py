from __future__ import annotations
from pathlib import Path
import numpy as np
import pandas as pd
import tables as tb
import math
from collections.abc import Mapping

import astropy.units as u
from tqdm.notebook import tqdm
from astropy.coordinates import SkyCoord
from astropy_healpix import HEALPix
from typing import Optional, Iterator, Literal, Any, Union
TableDescription = dict[str, tb.Col] | type[tb.IsDescription]

def infer_non_data_lines(read_csv_kwargs: Mapping) -> Optional[int]:
    """
    Infer how many *physical lines* at the start of the file are NOT data rows.

    We want to align:
      - physical line count from count_lines_fast()
      - actual number of data rows pd.read_csv(...) will yield

    This function returns:
      non_data_lines = skiprows_lines + header_lines

    Rules (pandas semantics):
    1) skiprows:
       - if skiprows is int: it skips that many physical lines at the top
       - if skiprows is list-like or callable: cannot infer without scanning,
         so we return None

    2) header:
       - header=None: no header line is consumed from the file
       - header=0 (or any int): one header line is consumed (the specified row
         provides column names, and that line is not part of data)
       - header is a list of ints (MultiIndex): consumes len(header) lines
       - header="infer" (default): behaves like header=0 in the common case

    3) names interaction:
       - If names are passed explicitly, pandas says behavior is identical to
         header=None, *unless* you explicitly pass header=0 to replace existing
         names. So:
           - names provided and header is None/"infer": header_lines = 0
           - names provided and header=0 (or list): header_lines follows header
    """
    # skiprows
    skiprows = read_csv_kwargs.get("skiprows", 0)
    if skiprows is None:
        skiprows_lines = 0
    elif isinstance(skiprows, int):
        skiprows_lines = max(skiprows, 0)
    else:
        # list-like or callable, we cannot infer without reading the file
        return None

    # header
    header = read_csv_kwargs.get("header", "infer")
    names = read_csv_kwargs.get("names", None)

    # Decide header_lines carefully based on pandas doc semantics
    if header is None:
        header_lines = 0
    elif isinstance(header, list):
        header_lines = len(header)
    else:
        # header is "infer" or an int like 0,1,2...
        # If names provided, pandas says it acts like header=None,
        # except when header=0 is explicitly used to replace existing names.
        if names is not None and header == "infer":
            header_lines = 0
        else:
            header_lines = 1

    return skiprows_lines + header_lines

def count_lines_fast(path, block_size=1024 * 1024):
    n = 0
    last_byte = b""
    with open(path, "rb") as f:
        while True:
            b = f.read(block_size)
            if not b:
                break
            n += b.count(b"\n")
            last_byte = b[-1:]
    # 如果文件非空且最后一个字节不是 \n，说明最后一行没被计入
    if last_byte and last_byte != b"\n":
        n += 1
    return n

def estimate_total_chunks(
    file: Union[str, Path],
    chunksize: int,
    read_csv_kwargs: Mapping,
    count_lines_fn,
) -> Optional[int]:
    """
    Estimate how many chunks pd.read_csv(..., chunksize=...) will yield.

    Returns:
      - int total_chunks if we can infer it
      - None if we cannot safely infer it (use tqdm(total=None))
    """
    if chunksize <= 0:
        raise ValueError("chunksize must be > 0")

    non_data = infer_non_data_lines(read_csv_kwargs)
    if non_data is None:
        return None

    n_lines = count_lines_fn(file)  # includes header line(s) physically present
    n_data_lines = max(n_lines - non_data, 0)
    if n_data_lines == 0:
        return 0
    return math.ceil(n_data_lines / chunksize)

def define_column_desc(
    magnitude_column_names: list[str],
    id_name_length: int = 16,
) -> dict[str, tb.Col]:

    """
    Build a PyTables table-description dictionary for a standard-star catalog.

    The returned mapping can be passed as the ``description`` argument to
    ``tables.File.create_table(...)`` to define the table schema. The schema is:

    - Fixed columns: ``id_name``, ``ra``, ``ra_err``, ``dec``, ``dec_err``
    - User-provided photometry columns: entries in ``magnitude_column_names`` (float32)
    - Computed index columns: ``ipix`` and ``bucket`` (int32)

    The physical column order in the table is controlled via the ``pos`` keyword,
    assigned sequentially in the same order listed above.

    Parameters
    ----------
    magnitude_column_names : list[str]
        Names of photometry-related columns to include as ``Float32`` columns.
        This list should contain both magnitudes and their uncertainties, typically
        with magnitudes first and then magnitude errors, e.g.
        ``["mag_g", "mag_r", "emag_g", "emag_r"]``.

        Column names in this list must not conflict with the reserved schema names:
        ``{"id_name", "ra", "ra_err", "dec", "dec_err", "ipix", "bucket"}``.
    id_name_length: int
        The number of the id_name characters.

    Returns
    -------
    dict[str, tb.Col]
        A dictionary mapping column names to ``tb.Col`` instances that fully define
        the table schema. This can be used directly as the ``description`` input
        to PyTables table creation.

    Raises
    ------
    ValueError
        If any name in ``magnitude_column_names`` conflicts with reserved schema names.

    """

    column_descr: dict[str, tb.Col] = {}

    if len(set(magnitude_column_names)) != len(magnitude_column_names):
        raise ValueError("magnitude_column_names contains duplicate entries.")

    # make sure the magnitude column names doesn't contain the reserves
    # column names
    reserved = {"id_name", "ra", "ra_err", "dec", "dec_err", "ipix", "bucket"}
    mag_cols = set(magnitude_column_names)
    conflicts = reserved & mag_cols
    if conflicts:
        raise ValueError(f"`magnitude_column_names` contains reserved names: {sorted(conflicts)}")

    pos_number = 0

    column_descr["id_name"] = tb.StringCol(id_name_length, pos = pos_number)
    pos_number += 1

    column_descr["ra"] = tb.Float32Col(pos = pos_number)
    pos_number += 1

    column_descr["ra_err"] = tb.Float32Col(pos = pos_number)
    pos_number += 1

    column_descr["dec"] = tb.Float32Col(pos = pos_number)
    pos_number += 1

    column_descr["dec_err"] = tb.Float32Col(pos = pos_number)
    pos_number += 1


    for magnitude_column in magnitude_column_names:

        column_descr[magnitude_column] = tb.Float32Col(pos = pos_number)
        pos_number += 1

    column_descr["ipix"] = tb.Int32Col(pos = pos_number)
    pos_number += 1

    column_descr["bucket"] = tb.Int32Col(pos = pos_number)

    return column_descr


def iter_multi_csv_chunks(
    files: str | Path | list[str | Path],
    *,
    chunksize: int =1000,
    read_csv_kwargs: Optional[dict] = None):

    """
    Stream one or more delimited text files as pandas DataFrame chunks.

    This helper function implements the "read layer" of a streaming pipeline.
    It iterates over one or more input files and yields each file as a sequence
    of pandas DataFrame chunks, so downstream code can process large catalogs
    incrementally without loading the full file into memory.

    Internally, it calls ``pandas.read_csv(..., chunksize=...)`` to obtain an
    iterable reader (``TextFileReader``) that yields one DataFrame per chunk.
    Two nested ``tqdm`` progress bars are used: an outer bar for files and an inner
    bar for chunks within the current file.

    Parameters
    ----------
    files : str | pathlib.Path | list[str | pathlib.Path]
        One or more input paths. Files are processed sequentially.
    chunksize : int, default=1000
        Number of data rows per chunk yielded by pandas.
        Larger values reduce Python overhead but increase peak memory usage.
    read_csv_kwargs : dict | None, optional
        Extra keyword arguments forwarded to ``pandas.read_csv``.
        Common examples include ``sep``, ``engine``, ``header``, ``names``,
        ``skiprows``, ``dtype``, ``usecols``, ``na_values``, etc.
        If None, an empty dict is used.

        Notes on specific keys:
        - ``skiprows`` must be an integer representing the number of leading lines
          to skip. This value is also used to estimate the number of data rows for
          progress reporting.
        - If ``read_csv_kwargs`` includes ``chunksize``, it must match the
          ``chunksize`` argument; otherwise a ``ValueError`` is raised. When they
          match, the ``chunksize`` entry is removed from ``read_csv_kwargs`` to
          avoid passing the same keyword argument twice to ``read_csv``.

    Yields
    ------
    tuple[pathlib.Path, pandas.DataFrame]
        ``(file_path, chunk_df)`` where:

        - ``file_path`` is the current file being processed (as ``Path``).
        - ``chunk_df`` is a DataFrame containing up to ``chunksize`` rows from that file.
          The final chunk may contain fewer rows.

    Notes
    -----
    Chunk iterator semantics
        Passing ``chunksize`` to ``read_csv`` returns an iterable reader object
        (``TextFileReader``). Iterating over it yields successive DataFrame chunks.

    Nested progress bars
        The outer progress bar tracks file iteration. The inner progress bar tracks
        chunk iteration for the current file. ``position`` is set so both bars can
        be displayed simultaneously.

    Memory behavior
        Only one chunk DataFrame is held at a time (plus any downstream buffers),
        which is suitable for large catalogs.

    Examples
    --------
    Read a whitespace separated catalog in chunks:

    >>> from pathlib import Path
    >>> colnames = ["id_name", "ra", "dec", "mag_g"]
    >>> kwargs = {
    ...     "sep": r"\\s+",
    ...     "engine": "python",
    ...     "header": None,
    ...     "names": colnames,
    ...     "skiprows": 1,
    ... }
    >>> files = [Path("cat_part1.txt"), Path("cat_part2.txt")]
    >>> for file_path, df in iter_multi_csv_chunks(files, chunksize=10000, read_csv_kwargs=kwargs):
    ...     # process each chunk DataFrame
    ...     pass

    """

    read_csv_kwargs = dict(read_csv_kwargs or {})

    # check if chunksize is in read_csv_kwargs as well.
    # If both arg and read_csv_kwargs define chunksize,
    # then compare if they are equal.
    # If not equal, raise ValueError;
    # if equal, delete chunksize from read_csv_kwargs.
    if "chunksize" in read_csv_kwargs:
        kw_chunksize = int(read_csv_kwargs["chunksize"])
        if kw_chunksize != chunksize:
            raise ValueError(
                "chunksize mismatch: chunksize argument does not match "
                "read_csv_kwargs['chunksize']."
            )
        else:
            read_csv_kwargs.pop("chunksize")

    if not isinstance(files, list):
        files = [files]

    pbar_files = tqdm(files, desc="Files", total = len(files), position=0, leave=True)

    for file in pbar_files:

        file = Path(file)

        pbar_files.set_postfix_str(file.name, refresh = True)

        # calculate the total chunks for tqdm progress bar
        total_chunks = estimate_total_chunks(
            file=file,
            chunksize=chunksize,
            read_csv_kwargs=read_csv_kwargs,
            count_lines_fn=count_lines_fast,
        )

        reader = pd.read_csv(file, chunksize = chunksize, **read_csv_kwargs)

        pbar_chunks = tqdm(
            reader,
            desc = "Chunks",
            # 这样 0 行文件不会显示“0/0”的百分比（纯体验改进）。
            total = total_chunks if total_chunks else None,
            position = 1,
            leave=False,
            dynamic_ncols=True,
            mininterval=0.1,
            miniters=1,
        )

        for chunk in pbar_chunks:
            n = len(chunk)

            if "ra_err" not in chunk.columns:
                chunk["ra_err"] = np.full(n, np.nan, dtype=np.float32)

            if "dec_err" not in chunk.columns:
                chunk["dec_err"] = np.full(n, np.nan, dtype=np.float32)

            yield file, chunk

def write_std_h5(
    dataframe_iterator: Iterator[tuple[Path, pd.DataFrame]],
    ra_dec_hmsdms: bool,
    h5_output_path: str | Path,
    group_where: str,
    group_name: str,
    group_title: str,
    table_name: str,
    table_description: TableDescription,
    table_title: str,
    table_attrs: dict[str, Any],
    nside: int,
    bucket_size: int,
    *,
    order: Literal["nested", "ring"] = "nested",
) -> None:

    """
    Write a standard-star catalog stream to a PyTables HDF5 table.

    This function consumes an iterator of pandas DataFrame chunks (typically
    produced by ``pandas.read_csv(..., chunksize=...)``), computes HEALPix pixel
    indices (``ipix``) and coarse bucket ids (``bucket``), and appends the rows
    to a PyTables table inside a newly created HDF5 file.

    If ``h5_output_path`` already exists, it is deleted and recreated.

    Parameters
    ----------
    dataframe_iterator : Iterator[tuple[pathlib.Path, pandas.DataFrame]]
        Iterator yielding ``(file_path, chunk_df)`` pairs. ``file_path`` is
        provenance/debug information; all tabular values are read from
        ``chunk_df``. Each ``chunk_df`` must contain the columns required to fill
        all non-derived table fields (e.g., ``id_name``, ``ra``, ``dec``, and any
        magnitude or uncertainty columns defined by ``table_description``).
    ra_dec_hmsdms : bool
        If the input ra and dec are in hmsdms, they will be converted to degdeg.
    h5_output_path : str | pathlib.Path
        Output HDF5 file path. The file will be overwritten if it already exists.
    group_where : str
        HDF5 internal location (POSIX-style path) under which the group will be
        created, e.g. ``"/"`` or ``"/standards"``.
    group_name : str
        Name of the group to create under ``group_where`` (e.g., ``"apass"``).
    group_title : str
        Human-readable title for the created group node.
    table_name : str
        Name of the table to create under the group (e.g., ``"dr10"``).
    table_description : TableDescription
        Table schema passed to ``File.create_table``. This may be either a PyTables
        description class (subclass of ``tb.IsDescription``) or a description dict
        mapping column names to ``tb.Col`` instances.
    table_title : str
        Human-readable title for the created table node (stored as the HDF5 TITLE).
    table_attrs : dict[str, Any]
        Catalog-specific user attributes attached to ``table.attrs`` (units, catalog
        metadata, photometric system notes, provenance, etc.). Values must be
        HDF5-storable (basic scalars, strings, small arrays, etc.).

        The indexing parameters ``nside``, ``order``, and ``bucket_size`` are always
        written to ``table.attrs`` from the corresponding function arguments, so
        callers do not need to include them here. If ``table_attrs`` contains any of
        these keys, the values may be overwritten by the function arguments.
    nside : int
        HEALPix NSIDE used to compute ``ipix``.
    bucket_size : int
        Bucket id is computed as ``bucket = ipix // bucket_size``. Must be > 0.
    order : {"nested", "ring"}, optional
        HEALPix ordering scheme used to compute ``ipix``. Default is ``"nested"``.

    Returns
    -------
    None
        The output is written to disk as a side effect.

    Raises
    ------
    ValueError
        If ``bucket_size <= 0``.
    KeyError
        If a required DataFrame column is missing when filling table fields.

    Notes
    -----
    Flushing and indexing
        ``table.append(...)`` buffers rows in memory. ``table.flush()`` is called
        after ingestion to ensure all buffered rows are written to disk. Indexes are
        then created on ``bucket`` and ``ipix`` to accelerate spatial queries, and
        another flush persists the index data. Column indexes can be created via
        ``table.cols.<col>.create_index()``.
    Field assignment
        Rows are staged in a NumPy structured array created with ``dtype=table.dtype``.
        Values are assigned by field name, so assignment order does not matter as long
        as field names match the table schema.
    """

    # remove the existing h5 file
    h5_path = Path(h5_output_path)
    if h5_path.exists():
        h5_path.unlink()

    if bucket_size <= 0:
        raise ValueError("bucket_size must be > 0.")

    # This line is setting "storage filters" for the PyTables/HDF5
    # dataset (table/array): compression, (optional) byte order
    # shuffling, checksum, etc. Once you pass it to
    # create_table(..., filters=filters) later, the data written
    # will be stored on disk according to these rules, which helps
    # save space and speed up I/O (often making reads faster as well).
    filters = tb.Filters(complevel=5, complib="blosc:zstd", shuffle=True)
    # shuffle： 在压缩前把每个元素的字节重新排列，让相似字节靠在一起，通常能显著提高压缩比
    #（对数值型列特别有效）。只有在启用压缩时才能用

    # initialize the healpix map to calculate ipix later
    hp = HEALPix(nside = nside, order = order, frame = "icrs")

    with tb.open_file(h5_output_path, mode = "w") as h5:

        # create group
        group = h5.create_group(
            where=group_where,
            name=group_name,
            title=group_title,
            createparents=True,
        )

        # create table under the group
        table = h5.create_table(
            where=group,
            name=table_name,
            title=table_title,
            description=table_description,
            filters=filters,
        )

        # add necessary table attributes
        for key, value in table_attrs.items():
            table.attrs[key] = value
        table.attrs.nside = int(nside)
        table.attrs.order = str(order)
        table.attrs.bucket_size = int(bucket_size)

        # start writing files
        for file, chunk in dataframe_iterator:

            # if format is hmsdms, convert to degdeg
            if ra_dec_hmsdms:
                coord = SkyCoord(
                    ra=chunk["ra"],
                    dec=chunk["dec"],
                    unit=(u.hourangle, u.deg),
                )
                chunk["ra"] = coord.ra.deg
                chunk["dec"] = coord.dec.deg

            # calculate ipx and bucket numbers
            ra = chunk["ra"].to_numpy(dtype=float) * u.deg
            dec = chunk["dec"].to_numpy(dtype=float) * u.deg

            ipix = hp.lonlat_to_healpix(ra, dec).astype(np.int32)
            bucket = (ipix // int(bucket_size)).astype(np.int32)
            index_column = {
                "ipix": ipix,
                "bucket": bucket,
            }

            # initialize numpy structured array
            # this means the order of assigning columns values
            # doesn't matter as long as the column names match
            # the table.dtype.
            out = np.empty(len(chunk), dtype=table.dtype)

            for key in table.dtype.names:

                # write the ipix and bucket first since
                # they are calculated new columns
                if key in index_column:
                    out[key] = index_column[key]

                # next write id_name since it a string value
                elif key == "id_name":
                    out[key] = chunk["id_name"].astype(str).to_numpy()

                else:
                    out[key] = chunk[key].to_numpy(dtype=np.float32)

            table.append(out)

        table.flush()  # make sure all the files are saved
        table.cols.bucket.create_index()
        table.cols.ipix.create_index()
        table.flush()  # save index only

    return
