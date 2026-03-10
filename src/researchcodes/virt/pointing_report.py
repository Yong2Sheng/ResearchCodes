from __future__ import annotations

# standard library
import warnings
from pathlib import Path

# numerical / plotting
import matplotlib.pyplot as plt
import numpy as np

# astropy
import astropy.units as u
from astropy.coordinates import SkyCoord, Angle
from astropy.io import fits
from astropy.visualization import simple_norm
from astropy.wcs import FITSFixedWarning, WCS
from astropy.wcs.utils import pixel_to_skycoord

# utilities
from tabulate import tabulate
from tqdm.notebook import tqdm

warnings.filterwarnings("ignore", category=FITSFixedWarning)

class VIRTPointingReport:

    """
    Generate pointing-quality diagnostics for one or more VIRT FITS images.

    This class provides utilities to:

    - check whether each FITS image contains usable celestial WCS information,
    - compare the nominal telescope pointing from the FITS header with the
      WCS-derived field-of-view center,
    - visualize the pointing and field center on individual FITS images,
    - summarize pointing offsets in a Markdown table, and
    - plot all distinct science targets on an all-sky Aitoff map.

    Parameters
    ----------
    files : Path | list[Path] | list[str]
        One FITS file or a list of FITS files to include in the report.
    hdu_index : int, optional
        FITS HDU index used throughout the class for reading image data and
        headers. Default is 0.

    Notes
    -----
    The class assumes that telescope pointing and target coordinates are stored
    in FITS headers using the conventions adopted by the VIRT data products,
    such as ``RA``, ``Dec``, ``OBJRA``, and ``OBJDEC``.

    This code is currently intended only for VIRT, so the present frame-handling
    assumptions are acceptable for routine use. However, one potential issue to
    keep in mind is that the celestial frame implied by a FITS WCS is not always
    guaranteed to be FK5. In Astropy, the WCS-matched celestial frame can be
    queried with ``astropy.wcs.utils.wcs_to_celestial_frame``, and ``SkyCoord``
    objects can be transformed accordingly when needed. If this class is later
    extended to other instruments or more diverse WCS products, the plotting code
    should be revisited so that annotation coordinates are transformed to the
    actual celestial frame implied by the image WCS before plotting.
    """

    def __init__(
        self,
        files: Path | list[Path] | list[str] | str,
        hdu_index: int = 0,
    ) -> None:

        # standardize the input
        # list[str] or list[Path]
        if isinstance(files, list):
            # list[str]
            if isinstance(files[0], str):
                self.files = [Path(i) for i in files]
            # list[Path]
            elif isinstance(files[0], Path):
                self.files = files
        # Path
        elif isinstance(files, (Path, str)):
            self.files = [Path(files)]

        self.hdu_index = hdu_index

    def plot_pointing_offsets(
        self,
        save=True,
    ) -> None:

        """
        Plot the nominal pointing and WCS-derived field center for each FITS image.

        For every file in ``self.files``, this method:

        1. checks that a usable celestial WCS is present,
        2. obtains the nominal telescope pointing from the FITS header,
        3. obtains the center of the image from the solved WCS, and
        4. overlays both coordinates on the FITS image.

        Parameters
        ----------
        save : bool, optional
            If True, save each generated FITS overlay plot to disk. Default is True.

        Raises
        ------
        MissingWCSError
            If any FITS file does not contain usable celestial WCS information.

        Returns
        -------
        None
        """

        for file in tqdm(self.files):

            if not VIRTPointingReport.has_wcs(
                file=file,
                hdu_index=self.hdu_index,
            ):
                raise MissingWCSError(f"No celestial WCS found in {file}")

            pointing_and_center_coords, labels = VIRTPointingReport.get_pointing_and_fov_center(
                file=file,
                hdu_index=self.hdu_index,
            )

            # make the plot
            _ = VIRTPointingReport.plot_fits_with_skycoords(
                file=file,
                hdu_index=self.hdu_index,
                skycoords=pointing_and_center_coords,
                labels=labels,
                save=save,
            )

    def get_offset_form(
        self,
        save: bool = True,
    ) -> None:

        """
        Build and print a Markdown table summarizing pointing offsets.

        For each FITS file, this method compares the nominal telescope pointing from
        the header with the WCS-derived image center, and reports:

        - the file name,
        - the nominal pointing coordinate,
        - the field-of-view center coordinate,
        - the RA offset,
        - the Dec offset, and
        - the total angular separation in arcseconds.

        The table is printed to the console in GitHub-flavored Markdown format and
        can optionally be written to a Markdown file.

        Parameters
        ----------
        save : bool, optional
            If True, save the generated Markdown table to
            ``Image_Offset_Report.md`` in the current working directory.
            Default is True.

        Raises
        ------
        MissingWCSError
            If any FITS file does not contain usable celestial WCS information.

        Returns
        -------
        None
        """

        # table headers
        headers = ["File", "Pointing", "FOV Center", "RA Error", "Dec Error", "Separation[arcsec]"]

        # saving dir
        saving_dir = self.files[0].parent

        # table rows
        rows: list[list[str]] = []

        for file in tqdm(self.files):

            if not VIRTPointingReport.has_wcs(
                file=file,
                hdu_index=self.hdu_index,
            ):
                raise MissingWCSError(f"No celestial WCS found in {file}")

            # get pointing and wcs center coordinates
            pointing_and_center_coords, _ = VIRTPointingReport.get_pointing_and_fov_center(
                file=file,
                hdu_index=self.hdu_index,
            )

            # separate two coordinates
            pointing = SkyCoord(
                ra=pointing_and_center_coords.ra.deg[0],
                dec=pointing_and_center_coords.dec.deg[0],
                unit=(u.deg, u.deg),
                frame="fk5",
            )
            fov_center = SkyCoord(
                ra=pointing_and_center_coords.ra.deg[1],
                dec=pointing_and_center_coords.dec.deg[1],
                unit=(u.deg, u.deg),
                frame="fk5",
            )

            dra, ddec, sep = VIRTPointingReport.get_coord_errors(
                c1=pointing,
                c2=fov_center,
            )

            rows.append(
                [file.stem,
                 pointing.to_string("hmsdms", sep=":", precision=4),
                 fov_center.to_string("hmsdms", sep=":", precision=4),
                 dra,
                 ddec,
                 sep.value,
                ]
            )

        # print table
        md = tabulate(rows, headers=headers, tablefmt="github")
        print(md)

        if save:
            Path(saving_dir/"Image_Offset_Report.md").write_text(md, encoding="utf-8")


    def get_target_coordinates(
        self,
        format_coords: bool = True,
    ) -> SkyCoord | list[str]:

        """
        Collect unique target coordinates from FITS headers.

        This method reads ``OBJRA`` and ``OBJDEC`` from each FITS file, removes
        duplicate coordinates while preserving first-seen order, and returns the
        resulting target list as a single ``SkyCoord`` object.

        Parameters
        ----------
        format_coords : bool, optional
            If True, return a formatted coordinate string representation using
            ``SkyCoord.to_string("hmsdms")``. If False, return the raw ``SkyCoord``
            object. Default is True.

        Returns
        -------
        SkyCoord | str
            Unique target coordinates either as a ``SkyCoord`` object or as a
            formatted coordinate string, depending on ``format_coords``.
        """

        seen = set()
        ra = []
        dec = []

        for file in tqdm(self.files):

            coord: SkyCoord = VIRTPointingReport.get_skycoord_from_header(
                file=file,
                hdu_index=self.hdu_index,
                ra_header_key="OBJRA",
                dec_header_key="OBJDEC",
            )

            key = (float(coord.ra.deg), float(coord.dec.deg))
            if key in seen:
                continue
            seen.add(key)
            ra.append(coord.ra.deg)
            dec.append(coord.dec.deg)

        target_coords = SkyCoord(
            ra=ra,
            dec=dec,
            unit=(u.deg, u.deg),
            frame="fk5",
        )

        if format_coords:
            return target_coords.to_string("hmsdms", sep=":", precision=3)
        else:
            return target_coords

    def plot_all_targets_aitoff(
        self,
        target_names: str | list[str],
        frame: str = "galactic",
        save: bool = True,
    ) -> None:

        """
        Plot all distinct targets on an all-sky Aitoff map.

        The coordinates are taken from ``self.get_target_coordinates`` and are
        transformed to the requested plotting frame before being displayed on a
        Matplotlib Aitoff projection.

        Parameters
        ----------
        target_names : list[str]
            Labels corresponding to the distinct target coordinates returned by
            ``self.get_target_coordinates(format_coords=False)``. The order must
            match the coordinate order.
        frame : str, optional
            Coordinate frame used for plotting. Supported values are ``"galactic"``
            and ``"icrs"``. Default is ``"galactic"``.
        save : bool, optional
            If True, save the generated all-sky plot to disk. Default is True.

        Raises
        ------
        ValueError
            If the number of names does not match the number of target coordinates,
            or if ``frame`` is unsupported.

        Returns
        -------
        None
        """

        if isinstance(target_names, str):
            target_names = [target_names]

        skycoords = self.get_target_coordinates(format_coords=False,)

        if len(skycoords) != len(target_names):
            raise ValueError("The number of coordinates must match the number of target names.")


        # unify plotting frame
        if frame.lower() == "galactic":
            coords = skycoords.galactic
            lon = coords.l.wrap_at(180 * u.deg).radian
            lat = coords.b.radian
            xlabel = "Galactic Longitude"
            ylabel = "Galactic Latitude"
        elif frame.lower() == "icrs":
            coords = skycoords.icrs
            lon = coords.ra.wrap_at(180 * u.deg).radian
            lat = coords.dec.radian
            xlabel = "Right Ascension"
            ylabel = "Declination"
        else:
            raise ValueError("frame must be 'galactic' or 'icrs'")

        fig = plt.figure(figsize=(10, 6))
        ax = fig.add_subplot(111, projection="aitoff")
        ax.grid(True)

        ax.scatter(lon, lat, s=40)

        for x, y, name in zip(lon, lat, target_names):
            ax.annotate(
                name,
                xy=(x, y),
                xytext=(5, 5),
                textcoords="offset points",
                ha="left",
                va="bottom",
            )

        ax.set_title("All-sky target map")
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
        plt.tight_layout()

        if save:
            fig.savefig("All_sky_target_map", dpi=150,  bbox_inches="tight")
        plt.show()

    @staticmethod
    def plot_fits_with_skycoords(
        file: Path | str,
        skycoords: SkyCoord,
        labels: list[str],
        hdu_index: int = 0,
        save = True,
    ) -> None:

        """
        Plot a FITS image with one or more celestial coordinates overlaid.

        The FITS image is displayed using its WCS projection, and the supplied
        coordinates are drawn on top of the image together with text labels.
        Image contrast is scaled with an asinh stretch for improved visibility of
        both bright and faint structures.

        Parameters
        ----------
        file : Path | str
            Input FITS file to display.
        skycoords : SkyCoord
            Coordinates to overlay on the image. These must be compatible with the
            image WCS.
        labels : list[str]
            Text labels associated with each coordinate in ``skycoords``.
        save : bool, optional
            If True, save the generated figure as a PNG file named after the FITS
            stem. Default is True.

        Raises
        ------
        ValueError
            If the number of coordinates does not match the number of labels.

        Returns
        -------
        None
        """

        file = Path(file)

        # check if the number of coordinates match the number of labels
        if len(skycoords) != len(labels):
            raise ValueError("The number of sky coordinates don't match labels.")

        # read fits file
        with fits.open(file) as hdul:
            hdu = hdul[hdu_index]
            wcs = WCS(hdu.header)
            data = hdu.data
            header = hdu.header

        fig, ax = plt.subplots(figsize=(8, 8), subplot_kw={"projection": wcs})

        # asinh can preserve both bright cores and dime sources and structures
        norm = simple_norm(data, stretch="asinh", percent=99.5)

        # plot data
        im = ax.imshow(data, origin="lower", cmap="gray", norm=norm)
        ax.grid(color="white", ls="solid", alpha=0.5)
        ax.set_xlabel("RA")
        ax.set_ylabel("Dec")

        # loop the colors if need to plot more than 6 coordinates
        colors = ["pink", "cyan", "yellow", "lime", "orange", "magenta"]
        edgecolors = [colors[i % len(colors)] for i in range(len(skycoords))]

        # plot coordinates
        ax.scatter_coord(
            skycoords,
            s=80,
            facecolors="none",
            edgecolors=edgecolors,
            linewidths=1.5,
        )

        # plot labels
        for coord, label, color in zip(skycoords, labels, edgecolors):

            ax.annotate(
                label,
                xy=(coord.ra.deg, coord.dec.deg),
                xycoords=ax.get_transform("fk5"),
                xytext=(5, 5),
                textcoords="offset points",
                color=color,
                ha="left",
                va="bottom",
            )

        fig.colorbar(im, ax=ax, pad=0.02)

        ax.set_title(f"{file.stem}\n{header['DATE-OBS']}")

        if save:
            fig.savefig(file.parent / f"{file.stem}.png", dpi=150,  bbox_inches="tight")

        plt.show()

    @staticmethod
    def has_wcs(
        file: str | Path,
        hdu_index: int = 0,
        require_celestial: bool = True,
    ) -> bool:

        """
        Check whether a FITS HDU contains usable WCS information.

        This method attempts to construct an ``astropy.wcs.WCS`` object from the
        specified FITS header. By default, it requires that the WCS include a
        celestial component, such as RA/Dec axes.

        Parameters
        ----------
        file : str | Path
            Path to the FITS file.
        hdu_index : int, optional
            HDU index to inspect. Default is 0.
        require_celestial : bool, optional
            If True, require a celestial WCS component. If False, accept any parsed
            WCS with at least one axis. Default is True.

        Returns
        -------
        bool
            True if usable WCS information is present, otherwise False.

        Notes
        -----
        Any exception encountered while opening the FITS file or parsing the WCS is
        caught and treated as a False result.
        """

        try:
            with fits.open(file, memmap=False) as hdul:
                header = hdul[hdu_index].header
                w = WCS(header)

                if require_celestial:
                    return bool(w.has_celestial)

                return w.naxis > 0

        except Exception:
            return False

    @staticmethod
    def get_skycoord_from_header(
        file: Path | str,
        hdu_index: int = 0,
        ra_header_key: str = "RA",
        dec_header_key: str = "Dec",
    ) -> SkyCoord:

        """
        Read a celestial coordinate pair from FITS header keywords.

        This method extracts one RA-like keyword and one Dec-like keyword from the
        specified FITS header and returns them as a ``SkyCoord`` object in the FK5
        frame.

        Parameters
        ----------
        file : Path | str
            FITS file from which the coordinates will be read.
        hdu_index : int, optional
            HDU index containing the header. Default is 0.
        ra_header_key : str, optional
            Header keyword containing the right ascension value. Default is ``"RA"``.
        dec_header_key : str, optional
            Header keyword containing the declination value. Default is ``"Dec"``.

        Returns
        -------
        SkyCoord
            Coordinate pair parsed from the FITS header.

        Notes
        -----
        In the VIRT workflow, ``RA`` and ``Dec`` are used for the nominal telescope
        pointing, while ``OBJRA`` and ``OBJDEC`` describe the requested science
        target position.
        """

        with fits.open(file, memmap=False) as hdul:
            header = hdul[hdu_index].header

        ra_hms = header[ra_header_key]
        dec_dms = header[dec_header_key]

        return SkyCoord(
            ra=ra_hms,
            dec=dec_dms,
            unit=(u.hourangle, u.deg),
            frame="fk5"
        )

    @staticmethod
    def get_fov_center_skycoord(
        file: Path | str,
        hdu_index: int = 0,
    ) -> SkyCoord:

        """
        Compute the sky coordinate of the image center pixel using WCS.

        The geometric center of the image array is computed in pixel coordinates and
        then transformed into a celestial coordinate using the FITS WCS solution.

        Parameters
        ----------
        file : Path | str
            FITS image file.
        hdu_index : int, optional
            HDU index containing the image data and WCS header. Default is 0.

        Returns
        -------
        SkyCoord
            Sky coordinate corresponding to the center pixel of the image.

        Raises
        ------
        MissingWCSError
            If the FITS file does not contain usable celestial WCS information.
        """

        # check is WCS is already solved
        if not VIRTPointingReport.has_wcs(file,hdu_index=hdu_index):
            raise MissingWCSError(f"No celestial WCS found in {file}")

        # access the data and wcs header
        with fits.open(file, memmap=False) as hdul:
            data = hdul[hdu_index].data
            header = hdul[hdu_index].header

        wcs = WCS(header)

        # get center pixel coordinate
        ny, nx = data.shape
        x_center = (nx - 1) / 2
        y_center = (ny - 1) / 2

        # transform the center coordinate to the SkyCoord
        center_coord = pixel_to_skycoord(x_center, y_center, wcs, origin=0)

        return center_coord

    @staticmethod
    def get_pointing_and_fov_center(
        file: Path,
        hdu_index: int = 0
    ) -> tuple(SkyCoord, list[str]):

        """
        Return the nominal telescope pointing and WCS-derived image center.

        This is a convenience method that combines the nominal pointing coordinate
        from the FITS header with the field-of-view center derived from the solved
        WCS into a single two-element ``SkyCoord`` object.

        Parameters
        ----------
        file : Path
            FITS file to inspect.
        hdu_index : int, optional
            HDU index used for header and image access. Default is 0.

        Returns
        -------
        tuple[SkyCoord, list[str]]
            A tuple containing:

            - a two-element ``SkyCoord`` object with
              ``[pointing, fov_center]``, and
            - a matching list of labels
              ``["Pointing", "FOV Center"]``.
        """

        labels = []
        # get the telescope pointing coordinate
        telescope_pointing = VIRTPointingReport.get_skycoord_from_header(
            file = file,
            hdu_index = hdu_index,
            ra_header_key = "RA",
            dec_header_key = "Dec",
        )
        labels += ["Pointing"]

        # get FOV center coordinates after resolving WCS
        center_coord = VIRTPointingReport.get_fov_center_skycoord(
            file = file,
            hdu_index = hdu_index,
        )
        labels += ["FOV Center"]

        # put two SkyCoord objects into one object
        pointing_and_center_coords = np.concatenate(
            [telescope_pointing[None], center_coord[None]],
        )

        return pointing_and_center_coords, labels

    @staticmethod
    def get_coord_errors(
        c1: SkyCoord,
        c2: SkyCoord
    ) -> tuple(str, str, Angle):

        """
        Compute coordinate offsets and angular separation between two positions.

        The method returns the local RA offset, the local Dec offset, and the total
        on-sky angular separation between two celestial coordinates.

        Parameters
        ----------
        c1 : SkyCoord
            Reference coordinate.
        c2 : SkyCoord
            Comparison coordinate.

        Returns
        -------
        tuple[str, str, Angle]
            A tuple containing:

            - RA offset formatted as an HMS-like string,
            - Dec offset formatted as a DMS-like string, and
            - total angular separation as an Astropy angle object.

        Notes
        -----
        The RA and Dec offsets are computed using spherical coordinate offsets,
        while the total separation is computed as the great-circle angular distance.
        """

        # 1) angular separation
        sep = c1.separation(c2)

        # 2) separation along RA and Dec
        # dra, ddec are all Angles
        dra, ddec = c1.spherical_offsets_to(c2)

        # 3) format
        dra_hms = dra.to_string(unit=u.hourangle, sep=":", precision=3, alwayssign=True)
        ddec_dms = ddec.to_string(unit=u.deg, sep=":", precision=3, alwayssign=True)

        return dra_hms, ddec_dms, sep

class MissingWCSError(ValueError):
    """
    Raised when a FITS file does not contain usable celestial WCS information.
    """
