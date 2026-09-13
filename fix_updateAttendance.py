import re

def update():
    filepath = "src/client/components/categories/LabourSalaryTab.tsx"
    with open(filepath, "r") as f:
        content = f.read()

    old_fn = """  const updateAttendance = (index: number, field: string, value: string) => {
    const newAtt = [...attendances];
    (newAtt[index] as any)[field] = value;
    setAttendances(newAtt);
  };"""

    new_fn = """  const updateAttendance = (index: number, field: string, value: string) => {
    const newAtt = [...attendances];
    newAtt[index] = { ...newAtt[index], [field]: value };
    
    // Auto-reset when changing typeCategory
    if (field === "typeCategory") {
      if (value === "Day") {
        newAtt[index].attendanceType = "Full-day";
      } else {
        newAtt[index].attendanceType = "TC";
      }
    }
    
    setAttendances(newAtt);
  };"""

    content = content.replace(old_fn, new_fn)
    
    with open(filepath, "w") as f:
        f.write(content)

update()
