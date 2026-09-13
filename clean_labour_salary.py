import re

def update():
    filepath = "src/client/components/categories/LabourSalaryTab.tsx"
    with open(filepath, "r") as f:
        content = f.read()

    # Remove analyticsSearch, selectedDetails
    content = re.sub(r'const \[analyticsSearch, setAnalyticsSearch\] = useState\(""\);\n', '', content)
    content = re.sub(r'const \[selectedDetails, setSelectedDetails\] = useState<any>\(null\);\n', '', content)
    
    # Remove teamAnalytics, filteredAnalytics, detailsRecords
    content = re.sub(r'const teamAnalytics = useMemo\(\(\) => \{.*?\n  \}, \[records\]\);\n', '', content, flags=re.DOTALL)
    content = re.sub(r'const filteredAnalytics = useMemo\(\(\) => \{.*?\n  \}, \[teamAnalytics, analyticsSearch\]\);\n', '', content, flags=re.DOTALL)
    content = re.sub(r'const detailsRecords = useMemo\(\(\) => \{.*?\n  \}, \[records, selectedDetails\]\);\n', '', content, flags=re.DOTALL)

    # Remove Analytics Dashboard JSX
    content = re.sub(r'\{/\* Analytics Dashboard \*/\}.*?(?=\{/\* Raw Records Table \*/\})', '', content, flags=re.DOTALL)

    # Remove Attendance Details Modal JSX
    content = re.sub(r'<Modal isOpen=\{!!selectedDetails\}.*?</Modal>', '', content, flags=re.DOTALL)

    with open(filepath, "w") as f:
        f.write(content)

update()
