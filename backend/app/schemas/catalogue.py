"""Validated catalogue records handed to the repositories (OR-012).

Source adapters (OR-013) map their payloads to these models. A record that fails
validation, for example one missing ``source_id``, never reaches the database; the
sync service counts it as an error.
"""

from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, HttpUrl, TypeAdapter

_HTTP_URL: TypeAdapter[HttpUrl] = TypeAdapter(HttpUrl)


def _http_url(value: str) -> str:
    """Only absolute http(s) URLs; stored as the normalised string."""
    return str(_HTTP_URL.validate_python(value))


SourceId = Annotated[str, Field(min_length=1, max_length=100)]
Url = Annotated[str, Field(max_length=2048), AfterValidator(_http_url)]


def _unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(values))


class _Record(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, str_strip_whitespace=True)


class ImageRecord(_Record):
    url: Url
    alt_text: str = Field(min_length=1, max_length=300)
    source_url: Url


class CategoryRecord(_Record):
    source_id: SourceId
    name: str = Field(min_length=1, max_length=200)
    parent_source_id: SourceId | None = None


class ProductRecord(_Record):
    source_id: SourceId
    name: str = Field(min_length=1, max_length=300)
    source_url: Url
    sku: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    # Absent price stays None; the database also rejects 0 and negatives.
    price_pkr: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    # Order is the display position. Duplicate URLs are dropped (first one wins).
    images: tuple[ImageRecord, ...] = ()
    category_source_ids: Annotated[list[SourceId], AfterValidator(_unique)] = []

    def unique_images(self) -> list[ImageRecord]:
        seen: dict[str, ImageRecord] = {}
        for image in self.images:
            seen.setdefault(str(image.url), image)
        return list(seen.values())
