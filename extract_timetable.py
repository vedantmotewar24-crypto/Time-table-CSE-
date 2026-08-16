import os
import re
import json
import pdfplumber

def clean_text(text):
    """Clean whitespace and newlines from a string."""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def normalize_batch(batch_str):
    """Normalize batch string formatting."""
    if not batch_str:
        return "ALL"
    b = re.sub(r'\s+', '', batch_str)
    return b

def parse_legends(pdf):
    """
    Extract room mapping, faculty mapping, and subject mapping from Page 2 legend tables.
    """
    p2 = pdf.pages[1]
    tables = p2.extract_tables()
    
    rooms = {}        # short_name -> full_name
    faculty_map = []  # list of dicts: {'subject': ..., 'batches': [...], 'teacher': ...}
    subjects = {}     # short_name -> full_name
    
    # Table 0: Rooms
    if len(tables) > 0:
        for row in tables[0][1:]:
            if row and len(row) >= 2 and row[0]:
                r_short = clean_text(row[0])
                r_full = clean_text(row[1])
                rooms[r_short] = r_full
            
    # Table 1: Faculty / Teachers
    if len(tables) > 1:
        for row in tables[1][1:]:
            if row and len(row) >= 2 and row[0] and row[1]:
                subj_batch = clean_text(row[0])
                teacher = clean_text(row[1])
                if ':' in subj_batch:
                    parts = subj_batch.split(':', 1)
                    subj = clean_text(parts[0])
                    batches = [normalize_batch(b) for b in parts[1].split(',') if clean_text(b)]
                    faculty_map.append({'subject': subj, 'batches': batches, 'teacher': teacher})
                else:
                    faculty_map.append({'subject': subj_batch, 'batches': ['ALL'], 'teacher': teacher})
                
    # Table 2: Subjects
    if len(tables) > 2:
        for row in tables[2][1:]:
            if row and len(row) >= 2 and row[0] and row[1]:
                s_short = clean_text(row[0])
                s_full = clean_text(row[1])
                subjects[s_short] = s_full
            
    # Standard special subjects if not in table
    if 'Open Elective' not in subjects:
        subjects['Open Elective'] = 'Open Elective'
    if 'Honour/Minor' not in subjects:
        subjects['Honour/Minor'] = 'Honour / Minor Course'
        
    return rooms, faculty_map, subjects

def get_teacher(faculty_map, subject_short, batch):
    """
    Map subject and batch to the corresponding teacher.
    """
    if not subject_short or subject_short in ['Open Elective', 'Honour/Minor']:
        return None
        
    # 1. Exact batch match first
    for item in faculty_map:
        if item['subject'] == subject_short:
            if batch != 'ALL' and batch in item['batches']:
                return item['teacher']
                
    # 2. General / ALL match
    for item in faculty_map:
        if item['subject'] == subject_short:
            if 'ALL' in item['batches']:
                return item['teacher']
            if batch == 'ALL':
                return item['teacher']
                
    return None

def parse_cell_content(cell_text, known_rooms, known_subjects):
    """
    Parse a single timetable cell to extract (batch, subject_code, room_code).
    """
    if not cell_text:
        return None
    
    raw = cell_text.strip()
    if not raw or raw.upper() == 'LUNCH':
        return None
    
    # Normalize internal newlines where parentheses or tokens split across lines
    normalized = re.sub(r'\(\s*\n\s*', '(', raw)
    normalized = re.sub(r'\n\s*\)', ')', normalized)
    clean_n = clean_text(normalized)
    
    # Check for Open Elective / Honour/Minor
    if 'Open Elective' in clean_n or 'Open\nElective' in normalized:
        return {
            'batch': 'ALL',
            'subject_code': 'Open Elective',
            'room_code': None
        }
    if 'Honour/' in clean_n or 'Minor' in clean_n:
        return {
            'batch': 'ALL',
            'subject_code': 'Honour/Minor',
            'room_code': None
        }
        
    # Check for Batch prefix e.g. SY1-S1, SY4-S6(DSY), etc.
    batch = 'ALL'
    batch_match = re.match(r'^(SY\d-S\d(?:\(DSY\))?)\s*(.*)', clean_n, re.IGNORECASE)
    rest = clean_n
    if batch_match:
        batch = normalize_batch(batch_match.group(1))
        rest = batch_match.group(2).strip()
        
    # Sort known subjects and rooms by length descending to match multi-word first
    sorted_subjects = sorted(known_subjects.keys(), key=len, reverse=True)
    sorted_rooms = sorted(known_rooms.keys(), key=len, reverse=True)
    
    found_subject = None
    found_room = None
    
    # 1. Match subject in rest
    for s in sorted_subjects:
        pattern = r'\b' + re.escape(s) + r'\b'
        if re.search(pattern, rest, re.IGNORECASE):
            found_subject = s
            rest_without_subj = re.sub(pattern, '', rest, count=1, flags=re.IGNORECASE).strip()
            break
    else:
        rest_without_subj = rest
        
    # 2. Match room
    for r in sorted_rooms:
        pattern = r'\b' + re.escape(r) + r'\b'
        if re.search(pattern, rest_without_subj, re.IGNORECASE) or re.search(pattern, rest, re.IGNORECASE):
            found_room = r
            break
            
    # Fallbacks if word boundaries miss (e.g. room ending with hyphen like NC-14-)
    if not found_room:
        for r in sorted_rooms:
            if r.lower() in rest.lower():
                found_room = r
                break
                
    if not found_subject:
        for s in sorted_subjects:
            if s.lower() in rest.lower():
                found_subject = s
                break
                
    return {
        'batch': batch,
        'subject_code': found_subject if found_subject else rest,
        'room_code': found_room
    }

def get_slot_time(col_idx, main_row, cell_text):
    """
    Calculate the start and end time slot based on column index and slot type (lab vs lecture).
    """
    # Standard column slot index mapping:
    # 1: 08:30 - 09:30
    # 2: 09:30 - 10:30
    # 3: 10:30 - 11:30 (or 10:30 - 12:30 for 2-hour lab)
    # 4: 11:30 - 12:30
    # 5: 12:30 - 13:30 (LUNCH)
    # 6: 13:30 - 14:30 (or 13:30 - 15:30 for 2-hour lab)
    # 7: 14:30 - 15:30
    # 8: 15:30 - 16:30 (or 15:30 - 17:30 for 2-hour lab)
    # 9: 16:30 - 17:30
    # 10: 17:30 - 18:30
    # 11: 18:30 - 19:30
    if col_idx == 1:
        return "08:30 - 09:30"
    elif col_idx == 2:
        return "09:30 - 10:30"
    elif col_idx == 3:
        if (main_row and len(main_row) > 4 and main_row[4] is None) or 'Lab' in cell_text:
            return "10:30 - 12:30"
        return "10:30 - 11:30"
    elif col_idx == 4:
        return "11:30 - 12:30"
    elif col_idx == 5:
        return "12:30 - 13:30"
    elif col_idx == 6:
        if (main_row and len(main_row) > 7 and main_row[7] is None) or 'Lab' in cell_text:
            return "13:30 - 15:30"
        return "13:30 - 14:30"
    elif col_idx == 7:
        return "14:30 - 15:30"
    elif col_idx == 8:
        if 'Lab' in cell_text or (main_row and len(main_row) > 9 and main_row[9] is None and main_row[8] and 'Lab' in main_row[8]):
            return "15:30 - 17:30"
        return "15:30 - 16:30"
    elif col_idx == 9:
        return "16:30 - 17:30"
    elif col_idx == 10:
        return "17:30 - 18:30"
    elif col_idx == 11:
        return "18:30 - 19:30"
    return "Unknown"

def extract_division_timetable(pdf_path):
    """
    Extract timetable and metadata from a single PDF file.
    """
    filename = os.path.basename(pdf_path)
    
    with pdfplumber.open(pdf_path) as pdf:
        p1 = pdf.pages[0]
        text_p1 = p1.extract_text() or ""
        
        # Extract Division Name from Page 1 header
        div_match = re.search(r'Timetable for Class:\s*(.+)', text_p1)
        if div_match:
            division_name = clean_text(div_match.group(1))
        else:
            # Fallback based on filename
            div_num = re.search(r'Div(\d)', filename)
            division_name = f"SY CSE Div {div_num.group(1)}" if div_num else filename
            
        # Parse Page 2 legends
        rooms_dict, faculty_map, subjects_dict = parse_legends(pdf)
        
        # Parse Page 1 timetable grid
        table = p1.extract_table()
        if not table:
            return None
            
        day_map = {
            'Mo\nn': 'Monday', 'Mon': 'Monday', 'M\non': 'Monday',
            'Tu\ne': 'Tuesday', 'Tue': 'Tuesday',
            'W\ned': 'Wednesday', 'Wed': 'Wednesday',
            'Th\nu': 'Thursday', 'Thu': 'Thursday',
            'Fri': 'Friday'
        }
        
        entries = []
        current_day = ""
        main_row_for_day = None
        
        for row in table[1:]:
            if row[0]:
                day_raw = row[0].strip()
                current_day = day_map.get(day_raw, day_raw)
                main_row_for_day = row
                
            for c_idx in range(1, len(row)):
                cell = row[c_idx]
                if cell is not None and cell.strip() != '':
                    if cell.strip().upper() == 'LUNCH':
                        continue
                    
                    parsed = parse_cell_content(cell, rooms_dict, subjects_dict)
                    if not parsed:
                        continue
                    
                    time_slot = get_slot_time(c_idx, main_row_for_day, cell)
                    subj_code = parsed['subject_code']
                    subj_name = subjects_dict.get(subj_code, subj_code)
                    room_code = parsed['room_code']
                    room_name = rooms_dict.get(room_code, room_code) if room_code else None
                    batch = parsed['batch']
                    faculty = get_teacher(faculty_map, subj_code, batch)
                    
                    session_type = "Lab" if "Lab" in subj_code else ("Elective" if "Elective" in subj_name or "Honour" in subj_name else "Lecture")
                    
                    entry = {
                        "division": division_name,
                        "day": current_day,
                        "time_slot": time_slot,
                        "subject_name": subj_name,
                        "subject_code": subj_code,
                        "faculty": faculty,
                        "room_number": room_code,
                        "room_name": room_name,
                        "batch": batch,
                        "session_type": session_type,
                        "raw_cell_text": cell.strip()
                    }
                    entries.append(entry)
                    
        return {
            "division": division_name,
            "pdf_file": filename,
            "rooms": rooms_dict,
            "faculty_mappings": faculty_map,
            "subjects": subjects_dict,
            "entries_count": len(entries),
            "entries": entries
        }

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    files = ['class_SY-Div1.pdf', 'class_SY-Div2.pdf', 'class_SY-Div3.pdf', 'class_SY-Div4.pdf']
    
    all_divisions = []
    all_entries = []
    
    print("=" * 60)
    print("EXTRACTING TIMETABLE DATA FROM PDF FILES")
    print("=" * 60)
    
    for f in files:
        fpath = os.path.join(base_dir, f)
        if not os.path.exists(fpath):
            print(f"Error: File {fpath} not found!")
            continue
            
        print(f"Processing: {f} ...")
        div_data = extract_division_timetable(fpath)
        if div_data:
            all_divisions.append(div_data)
            all_entries.extend(div_data["entries"])
            print(f"  -> Extracted {div_data['entries_count']} timetable entries for {div_data['division']}")
            
    # Structure into final JSON
    output_data = {
        "metadata": {
            "title": "COEP Technological University - Department of Computer Science & Engineering Timetables",
            "academic_year": "Odd Sem 26-27",
            "effective_date": "3 Aug 26",
            "total_divisions": len(all_divisions),
            "total_entries": len(all_entries),
            "divisions": [d["division"] for d in all_divisions]
        },
        "timetable_entries": all_entries,
        "division_timetables": {
            d["division"]: {
                "pdf_file": d["pdf_file"],
                "rooms": d["rooms"],
                "subjects": d["subjects"],
                "faculty_mappings": d["faculty_mappings"],
                "entries": d["entries"]
            }
            for d in all_divisions
        }
    }
    
    output_path = os.path.join(base_dir, "timetable_data.json")
    with open(output_path, "w", encoding="utf-8") as out_f:
        json.dump(output_data, out_f, indent=2, ensure_ascii=False)
        
    print("=" * 60)
    print(f"SUCCESS: Saved {len(all_entries)} entries to {output_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()
