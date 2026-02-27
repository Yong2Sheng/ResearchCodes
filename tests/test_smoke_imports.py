import pytest


@pytest.mark.smoke
def test_import():
    import researchcodes

    assert hasattr(researchcodes, "__version__")  # or: assert photozpy is not None