import re

files_to_patch = [
    "src/client/components/categories/LabourSalaryTab.tsx",
    "src/client/components/categories/MaterialLabourSupplyTab.tsx"
]

for file in files_to_patch:
    with open(file, "r") as f:
        content = f.read()

    old_use_effect = re.search(r"  useEffect\(\(\) => \{[\s\S]*?\}, \[locationId\]\);", content)
    if old_use_effect:
        old_str = old_use_effect.group(0)
        new_use_effect = """  useEffect(() => {
    loadData();
    loadMasterData();
  }, [locationId]);

  const loadMasterData = async () => {
    try {
      const parties = await apiFetch(`/master/parties?locationId=${locationId}`);
      if (parties && parties.length > 0) {
        if (typeof setPartyOptions === 'function') setPartyOptions(parties.map((p: any) => p.name));
      } else {
        if (typeof setPartyOptions === 'function' && typeof PRESET_PARTIES !== 'undefined') setPartyOptions(PRESET_PARTIES);
      }
      
      const teams = await apiFetch(`/master/teams?locationId=${locationId}`);
      if (teams && teams.length > 0) {
        if (typeof setTeamOptions === 'function') setTeamOptions(teams.map((t: any) => t.name));
      } else {
        if (typeof setTeamOptions === 'function' && typeof PRESET_TEAMS !== 'undefined') setTeamOptions(PRESET_TEAMS);
      }
    } catch (e) {
      console.error(e);
    }
  };"""
        content = content.replace(old_str, new_use_effect)
        with open(file, "w") as f:
            f.write(content)
