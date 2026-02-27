import pytest


@pytest.mark.smoke
def test_import():
    import researchcodes

    assert hasattr(researchcodes, "__version__")
