import random
from datetime import datetime, timedelta

departments = ['HK', 'FACILITY', 'FB', 'FRONT', 'CONCIERGE', 'EMERGENCY']
statuses = ['DONE', 'DONE', 'DONE', 'PENDING', 'PENDING', 'IN_PROGRESS', 'CANCELED']
priorities = ['NORMAL', 'NORMAL', 'NORMAL', 'URGENT']
rooms = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204', '205', '301', '302', '303', '304', '305', '401', '402', '403', '501', '502', '503', '707']

hk_issues = [
    ("I need extra pillows.", "Extra pillows requested", "Guest requested bedding"),
    ("Please make up my room.", "Room makeup", "Standard cleaning request"),
    ("Out of shampoo and body wash.", "Amenity refill", "Bathroom amenity refill"),
    ("Spilled wine on the carpet, need cleaning.", "Carpet cleaning", "Accidental spill"),
    ("Could I get an iron and ironing board?", "Iron requested", "Appliance requested"),
    ("There are no fresh towels left.", "Towels requested", "Amenity refill"),
    ("The trash bin is overflowing.", "Trash removal", "Cleaning request")
]

facility_issues = [
    ("The TV remote is not working.", "TV remote issue", "Battery or remote replacement"),
    ("Sink is draining very slowly.", "Slow drain", "Plumbing issue"),
    ("Light bulb is flickering in the bathroom.", "Flickering light", "Electrical maintenance"),
    ("Room is too cold, thermostat doesn't work.", "Heating issue", "HVAC maintenance"),
    ("Safe box won't open.", "Safe locked", "Security / Safe unlock"),
    ("The shower head is leaking water.", "Shower leak", "Plumbing maintenance"),
    ("Curtains are stuck and won't close.", "Curtain repair", "Furniture maintenance")
]

fb_issues = [
    ("I'd like to order a bottle of red wine.", "Wine order", "Room service: Beverage"),
    ("Can I get breakfast in bed tomorrow at 8 AM?", "Breakfast order", "Room service: Food"),
    ("Need some extra coffee pods for the machine.", "Coffee pods", "In-room dining amenity"),
    ("Two Club Sandwiches and a Coke, please.", "Food order", "Room service: Food"),
    ("Allergic to peanuts, please make sure the salad is safe.", "Allergy instruction", "Dietary request"),
    ("Can we have a bucket of ice sent up?", "Ice bucket", "Beverage accessory"),
    ("Please clear the room service trays.", "Tray clearance", "FB housekeeping")
]

front_issues = [
    ("Can I get a late checkout until 2 PM?", "Late checkout", "Checkout time extension"),
    ("Lost my room key at the pool.", "Lost key", "Key card replacement"),
    ("Wi-Fi keeps disconnecting.", "Wi-Fi issue", "Internet connection problem"),
    ("Could you print a document for me?", "Printing request", "Business center service"),
    ("The guests next door are shouting.", "Noise complaint", "Guest disturbance"),
    ("I need a wake-up call at 6 AM tomorrow.", "Wake-up call", "Front desk service"),
    ("Is it possible to switch to a room with a better view?", "Room change", "Accommodation modification")
]

concierge_issues = [
    ("Can you book a table at a sushi restaurant?", "Restaurant booking", "Dining reservation"),
    ("I need tickets to the museum.", "Museum tickets", "Tour booking"),
    ("Is there a good jogging route around here?", "Jogging route", "Local recommendation"),
    ("Please arrange a taxi to the train station.", "Taxi booking", "Transportation"),
    ("Where can I buy a local SIM card?", "SIM card info", "Local guidance"),
    ("Can you send my luggage to the airport?", "Luggage delivery", "Logistics service"),
    ("Any recommendations for kid-friendly activities?", "Activity recommendation", "Family planning")
]

emergency_issues = [
    ("I cut my hand deeply, I need a first aid kit!", "Medical emergency", "First aid required"),
    ("I smell smoke in the hallway.", "Smoke report", "Fire safety hazard"),
    ("Someone is trying to open my door.", "Security alert", "Guest security"),
    ("My wife just slipped in the bathroom and can't get up.", "Fall injury", "Medical emergency"),
    ("The elevator is stuck between floors.", "Stuck elevator", "Facility emergency")
]

dept_map = {
    'HK': hk_issues,
    'FACILITY': facility_issues,
    'FB': fb_issues,
    'FRONT': front_issues,
    'CONCIERGE': concierge_issues,
    'EMERGENCY': emergency_issues
}

with open("bulk_data.sql", "w", encoding="utf-8") as f:
    f.write("-- ============================================================\n")
    f.write("-- BULK GENERATED HOTEL DUMMY DATA\n")
    f.write("-- ============================================================\n\n")
    f.write("-- 10. MASSIVE BULK TICKETS (150 Items)\n")
    f.write("INSERT INTO request (id, status, priority, department_id, raw_text, summary, room_no, guest_id, reasoning, created_at, updated_at) VALUES\n")
    
    start_id = 114
    count = 150
    values = []
    messages = []
    
    for i in range(count):
        dept = random.choice(departments)
        issue = random.choice(dept_map[dept])
        status = random.choice(statuses)
        priority = random.choice(priorities)
        if dept == 'EMERGENCY': priority = 'URGENT'
        room = random.choice(rooms)
        
        minutes_ago = random.randint(1, 14400) # up to 10 days
        updated_ago = random.randint(0, minutes_ago)
        
        guest_id_sql = f"(SELECT id FROM pms_guest WHERE room_no = '{room}')" if room in ['101', '707'] else "NULL"
        
        issue_0 = issue[0].replace("'", "''")
        issue_1 = issue[1].replace("'", "''")
        issue_2 = issue[2].replace("'", "''")
        
        val = f"({start_id + i}, '{status}', '{priority}', '{dept}', '{issue_0}', '{issue_1}', '{room}', {guest_id_sql}, '{issue_2}', NOW() - INTERVAL '{minutes_ago} minutes', NOW() - INTERVAL '{updated_ago} minutes')"
        values.append(val)
        
        # Message for Guest
        messages.append(f"('GUEST', '{issue_0}', '{room}', {guest_id_sql}, {start_id + i}, 'NEUTRAL', NOW() - INTERVAL '{minutes_ago} minutes')")
        # Message for AI
        messages.append(f"('AI', 'We have received your request regarding: {issue_1}. We will assist you shortly.', '{room}', {guest_id_sql}, {start_id + i}, 'POSITIVE', NOW() - INTERVAL '{max(0, minutes_ago - 2)} minutes')")
        
    f.write(",\n".join(values))
    f.write("\nON CONFLICT (id) DO NOTHING;\n\n")
    
    f.write(f"SELECT setval('request_id_seq', (SELECT COALESCE(MAX(id), {start_id + count - 1}) FROM request));\n\n")
    
    f.write("-- 11. MASSIVE BULK CHAT HISTORY\n")
    f.write("INSERT INTO message (sender_type, content, room_no, guest_id, request_id, sentiment, created_at) VALUES\n")
    f.write(",\n".join(messages))
    f.write(";\n")
