import re

def update():
    filepath = "src/server/routes/report.routes.ts"
    with open(filepath, "r") as f:
        content = f.read()

    query = """
    // Labour Attendance Analytics
    const rawLabourAtt = await db.select({
      month: sql<string>`substring(${labourSalaries.date}, 1, 7)`,
      team: labourSalaries.labourTeam,
      name: labourSalaries.labourName,
      attendanceType: labourSalaries.attendanceType,
      days: sql<string>`sum(${labourSalaries.days})`,
    }).from(labourSalaries)
    .where(and(eq(labourSalaries.userId, userId), eq(labourSalaries.isDeleted, 0)))
    .groupBy(
      sql`substring(${labourSalaries.date}, 1, 7)`,
      labourSalaries.labourTeam,
      labourSalaries.labourName,
      labourSalaries.attendanceType
    );

    const labourMetrics = {"""

    content = content.replace("const labourMetrics = {", query)
    content = content.replace("labourMetrics,", "labourMetrics,\n      rawLabourAtt,")

    with open(filepath, "w") as f:
        f.write(content)

update()
