import re

def patch_file():
    filepath = "src/client/pages/LocationsPage.tsx"
    with open(filepath, "r") as f:
        content = f.read()

    # Remove the records count block from the card
    target_block = """              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                <span className="text-gray-500">Records</span>
                <span className="font-semibold text-gray-900">{loc.recordCount}</span>
              </div>"""
    content = content.replace(target_block, "")

    with open(filepath, "w") as f:
        f.write(content)

patch_file()
