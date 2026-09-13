import re

def fix():
    filepath = "src/client/components/categories/LabourSalaryTab.tsx"
    with open(filepath, "r") as f:
        content = f.read()
    
    # Let's align everything to use "Day" instead of "Day-wise" and "TC" instead of "TC-wise"
    # in the state initialization and reset forms.
    content = content.replace('"Day-wise"', '"Day"')
    content = content.replace('"TC-wise"', '"TC"')
    
    with open(filepath, "w") as f:
        f.write(content)

fix()
