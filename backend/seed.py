import requests

URL = "http://localhost:5000/api/employees"

employees = [
    {"name": "Banana Joe Goldstein",       "employee_number": "001", "department": "Marketing"},
    {"name": "Sir Flops-a-Lot Cohen",      "employee_number": "002", "department": "IT"},
    {"name": "Waffles McBusiness",         "employee_number": "003", "department": "Finance"},
    {"name": "Captain Obvious Levy",       "employee_number": "004", "department": "Management"},
    {"name": "Disco Dave Peretz",          "employee_number": "005", "department": "HR"},
    {"name": "Noodle King Shapiro",        "employee_number": "006", "department": "R&D"},
    {"name": "Princess Spreadsheet",       "employee_number": "007", "department": "Finance"},
    {"name": "Professor Chaos Mizrahi",    "employee_number": "008", "department": "R&D"},
    {"name": "Turbo Granny Klein",         "employee_number": "009", "department": "Operations"},
    {"name": "Lord Snackington III",       "employee_number": "010", "department": "Management"},
    {"name": "Bongo Barry Friedman",       "employee_number": "011", "department": "Marketing"},
    {"name": "Madame Glitch Katz",         "employee_number": "012", "department": "IT"},
    {"name": "Spaghetti Steve Rosen",      "employee_number": "013", "department": "Operations"},
    {"name": "The Notorious BIG Data",     "employee_number": "014", "department": "IT"},
    {"name": "Dr. Yolo Weiss",             "employee_number": "015", "department": "R&D"},
    {"name": "Agent Undefined Blum",       "employee_number": "016", "department": "IT"},
    {"name": "Zumba Queen Segal",          "employee_number": "017", "department": "HR"},
    {"name": "Mister 404 Berkowitz",       "employee_number": "018", "department": "IT"},
    {"name": "Grandma Hackerman",          "employee_number": "019", "department": "IT"},
    {"name": "Flex Tape Tzur",             "employee_number": "020", "department": "Operations"},
]

for emp in employees:
    r = requests.post(URL, json=emp)
    detail = r.json().get("detail", "") if r.status_code != 201 else ""
    status = "OK" if r.status_code == 201 else ("SKIP: " + detail)
    print(f"{status:35s} {emp['name']}")

print("Done")
