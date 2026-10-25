"""Rebuild supabase/functions/prep-import/deploy-single-file.ts (index.ts + logic.ts in one file)."""
d = "supabase/functions/prep-import/"
logic = open(d + "logic.ts").read()
lines = open(d + "index.ts").read().split("\n")
imports = [l for l in lines if l.startswith("import ") and "./logic.ts" not in l]
rest = "\n".join(l for l in lines if not l.startswith("import "))
open(d + "deploy-single-file.ts", "w").write(
    "// GENERATED single-file bundle of index.ts + logic.ts, for pasting into the Supabase dashboard editor.\n"
    "// Regenerate with: python3 scripts/prep/bundle_import_fn.py (do not edit by hand).\n"
    + "\n".join(imports) + "\n\n" + logic.replace("export ", "") + "\n" + rest)
