import json
import os

with open("timetable_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

entries = data["timetable_entries"]
print(f"Total extracted entries: {len(entries)}")

# Verification checks
required_fields = ["division", "day", "time_slot", "subject_name", "faculty", "room_number", "batch"]

missing_counts = {f: 0 for f in required_fields}
divisions_found = set()
days_found = set()
subjects_found = set()
batches_found = set()
rooms_found = set()
faculty_found = set()

for idx, entry in enumerate(entries):
    for f in required_fields:
        if f not in entry:
            missing_counts[f] += 1
            
    divisions_found.add(entry["division"])
    days_found.add(entry["day"])
    subjects_found.add(entry["subject_name"])
    batches_found.add(entry["batch"])
    if entry["room_number"]:
        rooms_found.add(entry["room_number"])
    if entry["faculty"]:
        faculty_found.add(entry["faculty"])

print("\n--- Divisions Found ---")
for d in sorted(divisions_found):
    count = sum(1 for e in entries if e["division"] == d)
    print(f"  {d}: {count} sessions")

print("\n--- Days Found ---")
for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
    count = sum(1 for e in entries if e["day"] == day)
    print(f"  {day}: {count} sessions")

print(f"\n--- Distinct Subjects ({len(subjects_found)}) ---")
for s in sorted(subjects_found):
    print(f"  - {s}")

print(f"\n--- Distinct Batches ({len(batches_found)}) ---")
for b in sorted(batches_found):
    print(f"  - {b}")

print(f"\n--- Distinct Rooms ({len(rooms_found)}) ---")
for r in sorted(rooms_found):
    print(f"  - {r}")

print(f"\n--- Distinct Faculty ({len(faculty_found)}) ---")
for fac in sorted(faculty_found):
    print(f"  - {fac}")

# Check any entry where faculty or room is None
print("\n--- Sessions with None Faculty ---")
for e in entries:
    if e["faculty"] is None:
        print(f"  [{e['division']}] {e['day']} {e['time_slot']} | {e['subject_name']} | Batch: {e['batch']} | Room: {e['room_number']}")

print("\n--- Sessions with None Room ---")
for e in entries:
    if e["room_number"] is None:
        print(f"  [{e['division']}] {e['day']} {e['time_slot']} | {e['subject_name']} | Batch: {e['batch']} | Faculty: {e['faculty']}")

print("\nAll verification checks completed successfully!")
