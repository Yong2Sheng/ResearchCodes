import numpy as np
import pandas as pd

from typing import Literal
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import matplotlib.colors as mcolors

import random

# Possible issues
# It only works for two-model case: GAL + STAR
# When plotting
# We don't retrive photo-z from STAR model.
# STAR model is only used for SED plotting and comparision

class SpecResults():

    """Parse and visualize LePhare-style spectroscopic fitting output `.spec` files.

    This class reads a LePhare output `.spec` file and extracts:
    - Object identifier and best-fit photo-z with confidence bounds
    - Observed photometry (magnitudes and errors) and theoretical magnitudes
    - Model SEDs for each template/model type
    - Redshift PDF grid (when available)

    It also provides a convenience plotting routine to compare observed photometry
    against model SEDs and, when applicable, to display the redshift PDF.

    Parameters
    ----------
    file_path : str or pathlib.Path
        Path to the LePhare result file to parse.
    filters : list of str, optional
        Human-readable filter names aligned with the photometry rows in the file.
        These are attached to the magnitude table for plotting.
        The order of the filters must be the same as the input order for LePHARE zphot.

    Attributes
    ----------
    _identifier : str
        Object identifier from the file header.
    _mag_df : pandas.DataFrame
        Photometry table including wavelength, observed magnitudes and errors, plus
        a ``Filters`` column based on the ``filters`` input.
    _type_df : pandas.DataFrame
        Template/model summary table (best-fit on the first row after filtering).
    _pdf_df : pandas.DataFrame
        Redshift grid and PDF values.
    _model_dict : dict[str, pandas.DataFrame]
        Mapping from model name to a DataFrame of SED points with columns
        ``Wavelength`` and ``Magnitude``.
    _best_z, _z_lower, _z_higher : float
        Best-fit photo-z and lower/upper bounds as reported by the file.
    _plus_error, _minus_error : float
        Convenience error terms derived from bounds.
    _chi2 : float
        Best-fit chi-square.
    _pdf : float
        Best-fit PDF percentage as reported by the file.
    _nband : int
        Number of bands used in the fit.

    Notes
    -----
    Current limitations (based on the file format and plotting logic):
    - Primarily tested for a two-model comparison use case (for example GAL and STAR).
    - STAR models are used for SED plotting/comparison only; no photo-z is retrieved
      from STAR model entries.
    - Color assignment for unknown model names is randomized for visualization.

    Raises
    ------
    FileNotFoundError
        If ``file_path`` does not exist.
    ValueError
        If expected header sections cannot be located in the file.

    """

    def __init__(
        self,
        file_path: str | Path,
        filters: list[str] = [
            "SDSS g'", "SDSS r'", "SDSS i'", "SDSS z'",
            "UVW2", "UVM2", "UVW1", "UUU", "UBB", "UVV",],
    ) -> None:

        """Read the results file and populate photometry, model, and PDF fields.

        This initializer parses the input file once, builds internal DataFrames,
        and computes convenient summary properties (best-fit z, errors, chi2, etc.).
        """

        self.__file_path = Path(file_path)
        self.__filters = filters

        # read file by lines
        with open(self.__file_path, 'r') as file:
            lines_list = file.readlines()

        # define the start of header strings
        header_starts = ["# Ident", "# Mag", "# Zstep", "# Type"]

        # fine the index of these header rows
        hits = []
        for lineno, line in enumerate(lines_list, 0):
            matched = [t for t in header_starts if t in line]
            if matched:
                hits.append((lineno, matched, line.rstrip()))
        (
            self._ldent_idx,
            self._mag_idx,
            self._ztep_idx,
            self._type_idx,
        ) = [lineno for lineno, matched, text in hits]

        # get the number of filters, PDF steps, and fitting types
        self._filter_number = int(lines_list[self._mag_idx+1].split()[-1])
        self._pdf_steps = int(lines_list[self._ztep_idx+1].split()[-1])
        for lineno, line in enumerate(lines_list[self._type_idx+1:], 1):
            first_string = line.split()[0]
            try:
                float(first_string)
            except ValueError:
                self._type_number = lineno

        # dataframe of the identifier, spec-z, and photo-z
        self._ident_df = pd.read_csv(self.__file_path,
                                     sep = r"[,\s]+",
                                     header = self._ldent_idx,
                                     nrows = 1,
                                     engine = "python").shift(axis=1).iloc[:, 1:]
        self._identifier = self._ident_df["Ident"][0]

        # dataframe of the magnitudes
        mag_df_headers = lines_list[self._mag_idx].split()[1:]
        self._mag_df = pd.read_csv(self.__file_path,
                                   sep = r'\s+',
                                   names = mag_df_headers,
                                   header = self._type_idx + self._type_number,
                                   nrows = self._filter_number,
                                   engine = "python")
        self._mag_df["Filters"] = self.__filters
        self._mag_df = self._mag_df.sort_values(by='Lbd_mean')

        # data frame of the fitting types (templates/models)
        self._type_df = pd.read_csv(self.__file_path,
                                    sep = r'\s+',
                                    header = self._type_idx,
                                    nrows = self._type_number,
                                    engine = "python").shift(axis=1).iloc[:, 1:]
        self._type_df = SpecResults.drop_no_detections(self._type_df, key = "Nline", drop_value=0)

        # data frame of the z chi^2 PDF
        self._pdf_df = pd.read_csv(self.__file_path,
                                   sep = r'\s+',
                                   names = ["z", "PDF"],
                                   header = self._type_idx + self._type_number + self._filter_number,
                                   nrows = self._pdf_steps,
                                   engine="python")

        # model seds
        model_start = (
            self._type_idx + self._type_number
            + self._filter_number+ self._pdf_steps
        )
        self._model_dict = {}

        for index, row in self._type_df.iterrows():
            if row["Nline"] != 0:
                model_name = row["Type"]
                df = pd.read_csv(file_path,
                                 sep = r'\s+',
                                 names = ["Wavelength", "Magnitude"],
                                 header = model_start,
                                 nrows = row["Nline"],
                                 engine="python")
                self._model_dict[model_name] = df
                model_start += row["Nline"]

        # get the photoz and errors
        self._best_z = self._type_df.iloc[0,:]["Zphot"]
        self._z_lower = self._type_df.iloc[0,:]["Zinf"]
        self._z_higher = self._type_df.iloc[0,:]["Zsup"]
        self._plus_error = self._z_higher - self._best_z
        self._minus_error = self._best_z - self._z_lower

        # get pdz
        self._pdf = self._type_df.iloc[0,:]["PDF"]

        # get chi^2
        self._chi2 = self._type_df.iloc[0,:]["Chi2"]

        # get nband
        self._nband = self._type_df.iloc[0,:]["Nband"]


    @staticmethod
    def drop_no_detections(
        df: pd.DataFrame,
        key: str = "Mag",
        drop_value: float = -99,
    ) -> pd.DataFrame:

        """Drop rows representing non-detections in a table.

        Parameters
        ----------
        df : pandas.DataFrame
            Input table to filter.
        key : str, optional
            Column name to check against ``drop_value``.
        drop_value : int or float, optional
            Sentinel value indicating missing or invalid measurements.

        Returns
        -------
        pandas.DataFrame
            A copy of ``df`` with rows removed where ``df[key] == drop_value``.
            If no rows match, the original DataFrame is returned unchanged.

        """

        boolean = df[key] == drop_value
        idx = df.index[boolean] if boolean.any() else None

        if idx is not None:
            return df.drop(idx)
        else:
            return df


    def plot_results(
        self,
        model_to_plot: Literal["all"] | list[str] | str = "all",
    ) -> None:

        """Plot observed photometry against model SEDs and optionally the z PDF.

        Parameters
        ----------
        model_to_plot : "all" or list of str, optional
            Which model SED(s) to plot. If "all", plots every model found in the file.
            If a list, only models whose names appear in the list are plotted.

        Returns
        -------
        None
            The function creates a Matplotlib figure. The main panelshows SED
            curves and photometry; the second panel shows the redshift PDF
            when available (non-QSO best-fit type in the current implementation).

        """

        fig, ax = plt.subplots(figsize=(32,8), sharex=False, nrows=1, ncols=2,
                               gridspec_kw={"width_ratios": [2, 1], "wspace": 0.1})

        # plot models
        if model_to_plot == "all":
            model_to_plot = list(self._model_dict.keys())
        elif isinstance(model_to_plot, str):
            model_to_plot = list(model_to_plot)

        x_min = self._mag_df["Lbd_mean"].min() - 1000
        x_max = self._mag_df["Lbd_mean"].max() + 3000
        for model_name, model_sed in self._model_dict.items():

            if model_name in model_to_plot:

                if model_name == "QSO":
                    color = "violet"
                    linestyle = "solid"
                elif "GAL" in model_name:
                    color = "limegreen"
                    linestyle = "solid"
                elif model_name == "STAR":
                    color = "pink"
                    linestyle = "dashed"
                else:
                    named_colors = list(mcolors.CSS4_COLORS.keys())
                    color = random.choice(named_colors)
                    linestyle = "dashdot"

                wavelength = model_sed["Wavelength"]
                magnitude = model_sed["Magnitude"]

                ax[0].plot(wavelength, magnitude, label = model_name, color = color, linestyle = linestyle, linewidth=2.5)

                ax[0].set_xscale("log")
                ax[0].set_xlim([x_min, x_max])
                ax[0].set_xlabel("Wavelenght (${\AA}$)", fontsize = 16)
                ax[0].xaxis.set_minor_formatter(mticker.ScalarFormatter())
                ax[0].xaxis.set_minor_locator(plt.MaxNLocator(6))
                ax[0].xaxis.set_major_formatter(mticker.ScalarFormatter())
                ax[0].xaxis.set_major_locator(plt.MaxNLocator(1))

                ax[0].set_ylabel("AB Magnitude", fontsize = 16)
                ax[0].set_ylim([15, 27])

                ax[0].tick_params(axis="both", which="both", labelsize=16, length=6, width=1.5)

        # plot theoretical magnitudes of galaxy or powerlaw models
        ax[0].scatter(self._mag_df["Lbd_mean"], self._mag_df["Mag_gal"],
                      marker="o", facecolors="none", edgecolors="k", linewidths=1.5, s = 60,
                      label = "Theoretical")

        # plot observed magnitudes
        new_mag_df = SpecResults.drop_no_detections(self._mag_df) # drop bands without data (-99)
        mags = new_mag_df["Mag"].to_numpy()
        mags_error = new_mag_df["emag"].to_numpy()


        lolims = np.zeros(len(mags))
        for i in np.arange(len(mags)):
            if mags_error[i] == -1:
                lolims[i] = 1
                mags_error[i] = 2

        ax[0].invert_yaxis()
        ax[0].errorbar(new_mag_df["Lbd_mean"], mags,
                       xerr=new_mag_df["Lbd_width"]/2,
                       yerr=mags_error, lolims=lolims,
                       capsize=5,
                       linestyle='none',elinewidth=1, marker='o', markersize=10, color = "black",
                       label = "Observation")  # plot photometric mags

        ax[0].legend(fontsize = 16)

        title = (
            fr"{self._identifier}, $z={self._best_z:.4f}^{{+{self._plus_error:.4f}}}_{{-{self._minus_error:.4f}}}$, "
            fr"$\chi^2$={self._chi2}, PDF={self._pdf}%, Nband={self._nband}"
        )
        ax[0].set_title(title, fontsize=20)


        # if the model type is not QSO, then we can plot PDF
        # Current Fortran LePHARE doesn't compute photo-z confidence regions
        if self._type_df.iloc[0,:]["Type"] != "QSO":
            # plot PDF
            ax[1].plot(self._pdf_df["z"], self._pdf_df["PDF"], color = "red")
            #ax[1].set_xlim([0, 5])

            y_box = np.interp(self._best_z, self._pdf_df["z"], self._pdf_df["PDF"])
            y_box = y_box/2 # just to move it to the middle of y axis

            ax[1].errorbar(
                self._best_z, y_box,
                xerr=[[self._minus_error], [self._plus_error]],
                fmt="s", ms=10, capsize=10, label = "Confidence Region"
            )

            ax[1].set_title("PDF", fontsize = 16)
            ax[1].legend(fontsize = 16)
            ax[1].set_xlabel("Redshift", fontsize = 16)
            ax[1].set_ylabel("Probability", fontsize = 16)
            ax[1].tick_params(axis="both", which="both", labelsize=16, length=6, width=1.5)

        return
