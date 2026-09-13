import re

def update():
    filepath = "src/client/components/categories/LabourSalaryTab.tsx"
    with open(filepath, "r") as f:
        content = f.read()

    # Find where <Modal isOpen={isDetailsOpen} starts and ends
    start_str = "<Modal isOpen={isDetailsOpen}"
    start_idx = content.find(start_str)
    
    if start_idx != -1:
        # Find the matching closing </Modal>
        end_str = "</Modal>"
        end_idx = content.find(end_str, start_idx)
        if end_idx != -1:
            end_idx += len(end_str)
            content = content[:start_idx] + content[end_idx:]
    
    # Remove any unused state `isDetailsOpen`
    content = re.sub(r'const \[isDetailsOpen, setIsDetailsOpen\] = useState\(false\);\n', '', content)
    
    with open(filepath, "w") as f:
        f.write(content)

update()
