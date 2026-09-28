"""
Cuts Fraunces down to what the site uses, into src/fonts/.

The site sets Fraunces at 24px and up, in three styles: semibold headings,
a bold title on /game, and one italic line. The variable fonts from
@fontsource-variable/fraunces cover every weight, which the page doesn't
need: 148 KB for upright and italic. Each style here is fixed at its one
weight, but keeps the optical-size axis, so headings still get the display
design at large sizes (the browser picks the optical size from the font
size).

Run it again after updating @fontsource-variable/fraunces:

    pip install fonttools brotli
    python3 scripts/fraunces.py
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "node_modules/@fontsource-variable/fraunces/files"
OUT = ROOT / "src/fonts"

# (source style, weight, output file)
STYLES = [
    ("normal", 600, "fraunces-latin-600-normal.woff2"),
    ("normal", 700, "fraunces-latin-700-normal.woff2"),
    ("italic", 400, "fraunces-latin-400-italic.woff2"),
]


def unconditional_lookups(font):
    """
    What each of a font's feature variations substitutes when it applies
    without conditions, by position.
    """
    records = font["GSUB"].table.FeatureVariations.FeatureVariationRecord
    return {
        i: [list(sub.Feature.LookupListIndex) for sub in record.FeatureTableSubstitution.SubstitutionRecord]
        for i, record in enumerate(records)
        if not record.ConditionSet.ConditionTable
    }


def restore_unconditional(source, instance):
    """
    Fraunces swaps in alternate letters at small optical sizes, then has a
    record that applies otherwise and swaps nothing. Pinning the weight
    leaves the instancer's copy of that last record swapping the alternates
    too, so small-size letters show at every size. Put back what the source
    font's records without conditions substitute.
    """
    expected = unconditional_lookups(source)
    records = instance["GSUB"].table.FeatureVariations.FeatureVariationRecord
    assert len(records) == len(source["GSUB"].table.FeatureVariations.FeatureVariationRecord), "Fraunces changed: check its feature variations"
    for i, lookups in expected.items():
        assert not records[i].ConditionSet.ConditionTable, "Fraunces changed: check its feature variations"
        for sub, indices in zip(records[i].FeatureTableSubstitution.SubstitutionRecord, lookups, strict=True):
            # A fresh feature table, as the instancer shares one between records.
            feature = type(sub.Feature)()
            feature.FeatureParams = None
            feature.LookupListIndex = indices
            feature.LookupCount = len(indices)
            sub.Feature = feature


for style, weight, name in STYLES:
    source = TTFont(SOURCE / f"fraunces-latin-standard-{style}.woff2")
    font = TTFont(SOURCE / f"fraunces-latin-standard-{style}.woff2")
    instance = instancer.instantiateVariableFont(font, {"wght": weight})
    restore_unconditional(source, instance)
    instance.flavor = "woff2"
    instance.save(OUT / name)
    print(f"{name}: {(OUT / name).stat().st_size / 1024:.0f} KB")
