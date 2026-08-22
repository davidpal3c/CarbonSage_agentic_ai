"""Bounded location normalization for supported freight-lane decisions."""

from __future__ import annotations

import math
import re
from collections.abc import Iterable
from dataclasses import dataclass


def _words(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


@dataclass(frozen=True)
class LocationPoint:
    key: str
    label: str
    country: str
    latitude: float
    longitude: float
    aliases: tuple[str, ...] = ()


_LOCATIONS = (
    LocationPoint(
        key="changzhou",
        label="Changzhou, China",
        country="china",
        latitude=31.8107,
        longitude=119.9741,
        aliases=("chuangzhou",),
    ),
    LocationPoint("shanghai", "Shanghai, China", "china", 31.2304, 121.4737),
    LocationPoint("guangzhou", "Guangzhou, China", "china", 23.1291, 113.2644),
    LocationPoint("shenzhen", "Shenzhen, China", "china", 22.5431, 114.0579),
    LocationPoint("tokyo", "Tokyo, Japan", "japan", 35.6762, 139.6503),
    LocationPoint("osaka", "Osaka, Japan", "japan", 34.6937, 135.5023),
    LocationPoint("dubai", "Dubai, UAE", "united arab emirates", 25.2048, 55.2708),
    LocationPoint("abu dhabi", "Abu Dhabi, UAE", "united arab emirates", 24.4539, 54.3773),
    LocationPoint("mumbai", "Mumbai, India", "india", 19.076, 72.8777),
    LocationPoint("delhi", "Delhi, India", "india", 28.6139, 77.209),
    LocationPoint("chennai", "Chennai, India", "india", 13.0827, 80.2707),
    LocationPoint("toronto", "Toronto, Canada", "canada", 43.6532, -79.3832),
    LocationPoint("vancouver", "Vancouver, Canada", "canada", 49.2827, -123.1207),
    LocationPoint("madrid", "Madrid, Spain", "spain", 40.4168, -3.7038),
    LocationPoint("london", "London, UK", "united kingdom", 51.5072, -0.1276),
    LocationPoint(
        "rotterdam",
        "Rotterdam, Netherlands",
        "netherlands",
        51.9244,
        4.4777,
    ),
)

_COUNTRY_ALIASES = {
    "au": "australia",
    "australia": "australia",
    "br": "brazil",
    "brazil": "brazil",
    "ca": "canada",
    "canada": "canada",
    "china": "china",
    "france": "france",
    "germany": "germany",
    "india": "india",
    "indonesia": "indonesia",
    "japan": "japan",
    "malaysia": "malaysia",
    "mexico": "mexico",
    "netherlands": "netherlands",
    "singapore": "singapore",
    "south korea": "south korea",
    "spain": "spain",
    "taiwan": "taiwan",
    "thailand": "thailand",
    "uae": "united arab emirates",
    "united arab emirates": "united arab emirates",
    "united states": "united states",
    "us": "united states",
    "usa": "united states",
    "uk": "united kingdom",
    "united kingdom": "united kingdom",
    "vietnam": "vietnam",
}


def _location_aliases() -> dict[str, LocationPoint]:
    aliases: dict[str, LocationPoint] = {}
    for location in _LOCATIONS:
        country_aliases = [
            alias for alias, country in _COUNTRY_ALIASES.items() if country == location.country
        ]
        names = (location.key, *location.aliases)
        for name in names:
            aliases[_words(name)] = location
            for country_alias in country_aliases:
                aliases[_words(f"{name} {country_alias}")] = location
    return aliases


_LOCATION_ALIASES = _location_aliases()


def resolve_location(value: str) -> LocationPoint | None:
    """Resolve a known city, country suffix, or bounded spelling alias."""

    return _LOCATION_ALIASES.get(_words(value))


def location_key(value: str) -> str:
    """Return a stable city key while preserving unknown locations safely."""

    resolved = resolve_location(value)
    if resolved is not None:
        return resolved.key
    normalized = _words(value)
    for suffix in sorted(_COUNTRY_ALIASES, key=len, reverse=True):
        if normalized.endswith(f" {suffix}"):
            return normalized[: -(len(suffix) + 1)].strip()
    return normalized


def country_key(value: str) -> str | None:
    resolved = resolve_location(value)
    if resolved is not None:
        return resolved.country
    normalized = _words(value)
    for suffix in sorted(_COUNTRY_ALIASES, key=len, reverse=True):
        if normalized == suffix or normalized.endswith(f" {suffix}"):
            return _COUNTRY_ALIASES[suffix]
    return None


def canonical_location_label(value: str) -> str | None:
    resolved = resolve_location(value)
    return resolved.label if resolved is not None else None


def _distance_km(first: LocationPoint, second: LocationPoint) -> float:
    radius_km = 6_371.0088
    first_latitude = math.radians(first.latitude)
    second_latitude = math.radians(second.latitude)
    latitude_delta = math.radians(second.latitude - first.latitude)
    longitude_delta = math.radians(second.longitude - first.longitude)
    arc = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(first_latitude) * math.cos(second_latitude) * math.sin(longitude_delta / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(arc), math.sqrt(1 - arc))


def nearest_supported_origin(
    requested_origin: str,
    supported_origins: Iterable[str],
) -> tuple[str, float] | None:
    """Find the nearest known supported origin within the requested country."""

    requested = resolve_location(requested_origin)
    if requested is None:
        return None
    candidates: dict[str, tuple[str, LocationPoint]] = {}
    for origin in supported_origins:
        resolved = resolve_location(origin)
        if resolved is not None and resolved.country == requested.country:
            candidates.setdefault(resolved.key, (origin, resolved))
    if not candidates:
        return None
    origin, location = min(
        candidates.values(),
        key=lambda candidate: (_distance_km(requested, candidate[1]), candidate[0].casefold()),
    )
    return origin, round(_distance_km(requested, location), 1)
