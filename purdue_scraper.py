import requests
import json
import time

BASE_URL = "https://api.purdue.io/odata"
TERM_CODE = input("Input term code: ")

def fetch_all_subjects(session):
    """Fetches a list of all subjects available in the API."""
    print("Fetching all subjects...")
    url = f"{BASE_URL}/Subjects"
    try:
        r = session.get(url)
        r.raise_for_status()
        return r.json().get('value', [])
    except Exception as e:
        print(f"Error fetching subjects: {e}")
        return []

def fetch_courses_by_subject(session, subject_id, term_code):
    """Fetches courses for a given subject and term."""
    print(f"  Fetching courses for Subject ID: {subject_id}")
    params = {
        '$filter': f"SubjectId eq {subject_id}",
        '$expand': f"Classes($filter=Term/Code eq '{term_code}';$expand=Sections($expand=Meetings($expand=Instructors,Room($expand=Building))))"
    }
    url = f"{BASE_URL}/Courses"
    
    try:
        r = session.get(url, params=params)
        r.raise_for_status()
        return r.json().get('value', [])
    except Exception as e:
        print(f"  Error fetching courses for subject {subject_id}: {e}")
        return []

def main():
    all_courses = []
    
    with requests.Session() as s:
        # Step 1: Get a list of all subjects
        subjects = fetch_all_subjects(s)
        
        if not subjects:
            print("Failed to get subjects. Aborting.")
            return

        print(f"Found {len(subjects)} subjects. Starting course scrape.")
        
        # Step 2 & 3: Iterate through each subject to get its courses and details
        for i, subject in enumerate(subjects):
            subject_id = subject['Id']
            subject_abbr = subject['Abbreviation']
            
            print(f"\n[{i+1}/{len(subjects)}] Scraping {subject_abbr}...")
            
            courses = fetch_courses_by_subject(s, subject_id, TERM_CODE)
            if courses:
                all_courses.extend(courses)
            
            time.sleep(0.1) # Add a small delay to be polite to the server
            
    if all_courses:
        # The filter might leave empty courses. Let's clean them up before saving.
        courses_with_classes = [c for c in all_courses if c.get('Classes')]
        
        output_file = f"purdue_courses_{TERM_CODE}.json"
        with open(output_file, 'w') as f:
            json.dump(courses_with_classes, f, indent=4)
        
        print(f"\n✅ Successfully scraped and stored {len(courses_with_classes)} courses in '{output_file}'!")
    else:
        print("\n❌ Failed to scrape any courses.")

if __name__ == "__main__":
    main()