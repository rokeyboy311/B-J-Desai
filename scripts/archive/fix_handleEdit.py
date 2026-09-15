import re

def fix():
    filepath = "src/client/components/categories/LabourSalaryTab.tsx"
    with open(filepath, "r") as f:
        content = f.read()
    
    # In handleEdit
    old_str = 'if (r.attendanceType === "TC") {'
    new_str = 'if (r.attendanceType === "TC" || r.attendanceType === "TC-wise") {'
    content = content.replace(old_str, new_str)
    
    # In raw records table
    old_str3 = "r.attendanceType === 'TC' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'"
    new_str3 = "(r.attendanceType === 'TC' || r.attendanceType === 'TC-wise') ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'"
    content = content.replace(old_str3, new_str3)

    old_str4 = "r.attendanceType === 'TC' ? 'TCs' : 'Days'"
    new_str4 = "(r.attendanceType === 'TC' || r.attendanceType === 'TC-wise') ? 'TCs' : 'Days'"
    content = content.replace(old_str4, new_str4)
    
    with open(filepath, "w") as f:
        f.write(content)

fix()
