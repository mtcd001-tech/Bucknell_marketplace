"""Campus taxonomy.

These strings are MIRRORED from frontendprj/src/mocks/marketplace.js
(CAMPUS_CATEGORIES and CONDITIONS). They must match character-for-character --
the Sell form renders <option value="..."> from that file, so a draft carrying
a category string the dropdown doesn't contain silently fails to select.

If you change the list in one place, change it in the other. There is no
shared source of truth between the JS frontend and this Python service yet;
`test_enums_match_frontend` in the README's smoke-test section is the check.
"""

CAMPUS_CATEGORIES: list[str] = [
    "Textbooks",
    "Furniture",
    "Electronics",
    "Dorm & Kitchen",
    "Bikes & Transport",
    "Clothing",
    "Tickets & Passes",
    "Free Stuff",
]

CONDITIONS: list[str] = [
    "New",
    "Like New",
    "Good",
    "Fair",
    "Well Loved",
]

# Categories that don't follow the normal retail-depreciation model.
FREE_CATEGORY = "Free Stuff"
FACE_VALUE_CATEGORY = "Tickets & Passes"
