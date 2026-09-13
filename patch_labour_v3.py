import re

def update_file():
    filepath = "src/client/components/categories/LabourSalaryTab.tsx"
    with open(filepath, "r") as f:
        content = f.read()

    # Replace Day-wise -> Day and TC-wise -> TC
    content = content.replace('"Day-wise"', '"Day"')
    content = content.replace('"TC-wise"', '"TC"')
    
    # Replace the form fields section to have better classes
    # We will just replace the grid structure inside attendances.map
    
    with open(filepath, "w") as f:
        f.write(content)

update_file()
