"""
Assigns license plates to the first 15 employees (sorted by employee_number)
and deletes any employee that ends up without a plate.
Run with the venv active: python assign_plates.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from server import app, db, Employee, LicensePlate

PLATES = [
    "123-45-678",
    "45-454-54",
    "171-12-005",
    "90-909-90",
    "29-505-21",
    "928-32-314",
    "31-313-54",
    "545-75-235",
    "41-354-54",
    "234-13-354",
    "897-99-865",
    "345-22-123",
    "876-54-321",
    "12-345-67",
    "76-543-21",
]

with app.app_context():
    employees = Employee.query.order_by(Employee.employee_number).all()

    # Assign plates to first 15
    for emp, plate_str in zip(employees, PLATES):
        # Remove existing plates first
        for p in emp.plates:
            db.session.delete(p)
        db.session.flush()
        lp = LicensePlate(plate_number=plate_str.upper(), employee_id=emp.id)
        db.session.add(lp)
        print(f"  Assigned {plate_str}  →  {emp.name} ({emp.employee_number})")

    # Delete employees with no plate assignment
    for emp in employees[len(PLATES):]:
        print(f"  Deleting {emp.name} ({emp.employee_number})")
        db.session.delete(emp)

    db.session.commit()
    print("\nDone.")
