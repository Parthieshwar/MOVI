import sqlite3
import json
import os
import sys
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from datetime import datetime
from werkzeug.utils import secure_filename

# Add movi folder to path for ASR import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'movi'))
try:
    from movi.asr import transcribe_audio
except ImportError:
    print("Warning: ASR module not found. Audio transcription will be skipped.")
    transcribe_audio = None

app = Flask(__name__)
CORS(app)

DATABASE = 'moveinsync.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Drop existing tables
    cursor.execute('DROP TABLE IF EXISTS Deployments')
    cursor.execute('DROP TABLE IF EXISTS DailyTrips')
    cursor.execute('DROP TABLE IF EXISTS Routes')
    cursor.execute('DROP TABLE IF EXISTS Paths')
    cursor.execute('DROP TABLE IF EXISTS Stops')
    cursor.execute('DROP TABLE IF EXISTS Vehicles')
    cursor.execute('DROP TABLE IF EXISTS Drivers')
    
    # Create Stops table
    cursor.execute('''
        CREATE TABLE Stops (
            stop_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL
        )
    ''')
    
    # Create Paths table (stores ordered list as JSON)
    cursor.execute('''
        CREATE TABLE Paths (
            path_id TEXT PRIMARY KEY,
            path_name TEXT NOT NULL,
            ordered_list_of_stop_ids TEXT NOT NULL
        )
    ''')
    
    # Create Routes table
    cursor.execute('''
        CREATE TABLE Routes (
            route_id TEXT PRIMARY KEY,
            path_id TEXT NOT NULL,
            route_display_name TEXT NOT NULL,
            shift_time TEXT NOT NULL,
            direction TEXT NOT NULL,
            start_point TEXT NOT NULL,
            end_point TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            allowed_waitlist INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            FOREIGN KEY (path_id) REFERENCES Paths(path_id)
        )
    ''')
    
    # Create Vehicles table
    cursor.execute('''
        CREATE TABLE Vehicles (
            vehicle_id TEXT PRIMARY KEY,
            license_plate TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL,
            capacity INTEGER NOT NULL
        )
    ''')
    
    # Create Drivers table
    cursor.execute('''
        CREATE TABLE Drivers (
            driver_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone_number TEXT NOT NULL
        )
    ''')
    
    # Create DailyTrips table
    cursor.execute('''
        CREATE TABLE DailyTrips (
            trip_id TEXT PRIMARY KEY,
            route_id TEXT NOT NULL,
            display_name TEXT NOT NULL,
            booking_status_percentage INTEGER NOT NULL,
            live_status TEXT NOT NULL,
            FOREIGN KEY (route_id) REFERENCES Routes(route_id)
        )
    ''')
    
    # Create Deployments table
    cursor.execute('''
        CREATE TABLE Deployments (
            deployment_id TEXT PRIMARY KEY,
            trip_id TEXT NOT NULL,
            vehicle_id TEXT,
            driver_id TEXT,
            FOREIGN KEY (trip_id) REFERENCES DailyTrips(trip_id),
            FOREIGN KEY (vehicle_id) REFERENCES Vehicles(vehicle_id),
            FOREIGN KEY (driver_id) REFERENCES Drivers(driver_id)
        )
    ''')
    
    conn.commit()
    conn.close()

def populate_dummy_data():
    conn = get_db()
    cursor = conn.cursor()
    
    # Insert Stops
    stops = [
        ('S001', 'Tech Park Gate 1', 12.9352, 77.6245),
        ('S002', 'Whitefield Main', 12.9698, 77.7499),
        ('S003', 'Electronic City Phase 1', 12.8456, 77.6603),
        ('S004', 'Marathahalli Junction', 12.9591, 77.6974),
        ('S005', 'Silk Board', 12.9165, 77.6229),
        ('S006', 'Koramangala', 12.9352, 77.6245),
        ('S007', 'HSR Layout', 12.9116, 77.6382),
        ('S008', 'BTM Layout', 12.9165, 77.6101),
        ('S009', 'JP Nagar', 12.9081, 77.5854),
        ('S010', 'Bannerghatta Road', 12.8892, 77.5955)
    ]
    cursor.executemany('INSERT INTO Stops VALUES (?, ?, ?, ?)', stops)
    
    # Insert Paths
    paths = [
        ('P001', 'North Corridor Route', json.dumps(['S001', 'S002', 'S004', 'S003'])),
        ('P002', 'South Corridor Route', json.dumps(['S005', 'S006', 'S007', 'S008'])),
        ('P003', 'East Express Route', json.dumps(['S002', 'S004', 'S001'])),
        ('P004', 'West Circular Route', json.dumps(['S006', 'S005', 'S009', 'S010'])),
        ('P005', 'Central Loop', json.dumps(['S001', 'S005', 'S006', 'S003']))
    ]
    cursor.executemany('INSERT INTO Paths VALUES (?, ?, ?)', paths)
    
    # Insert Routes (derived from Paths)
    routes = [
        ('R001', 'P001', 'North Corridor - Morning Shift', '08:00 AM', 'Inbound', 'Tech Park Gate 1', 'Electronic City Phase 1', 45, 5, 'active'),
        ('R002', 'P002', 'South Corridor - Evening Shift', '06:00 PM', 'Outbound', 'Silk Board', 'BTM Layout', 40, 5, 'active'),
        ('R003', 'P003', 'East Express - Morning', '07:30 AM', 'Inbound', 'Whitefield Main', 'Tech Park Gate 1', 50, 7, 'active'),
        ('R004', 'P004', 'West Circular - Afternoon', '02:00 PM', 'Outbound', 'Koramangala', 'Bannerghatta Road', 35, 3, 'active'),
        ('R005', 'P005', 'Central Loop - Night Shift', '10:00 PM', 'Inbound', 'Tech Park Gate 1', 'Electronic City Phase 1', 30, 3, 'deactivated'),
        ('R006', 'P001', 'North Corridor - Evening Return', '06:30 PM', 'Outbound', 'Electronic City Phase 1', 'Tech Park Gate 1', 45, 5, 'active'),
        ('R007', 'P002', 'South Corridor - Morning', '08:30 AM', 'Inbound', 'BTM Layout', 'Silk Board', 40, 5, 'active'),
        ('R008', 'P003', 'East Express - Evening', '05:45 PM', 'Outbound', 'Tech Park Gate 1', 'Whitefield Main', 50, 7, 'deactivated')
    ]
    cursor.executemany('INSERT INTO Routes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', routes)
    
    # Insert Vehicles
    vehicles = [
        ('V001', 'KA-01-AB-1234', 'Bus', 45),
        ('V002', 'KA-02-CD-5678', 'Bus', 45),
        ('V003', 'KA-03-EF-9012', 'Bus', 40),
        ('V004', 'KA-04-GH-3456', 'Bus', 50),
        ('V005', 'KA-05-IJ-7890', 'Cab', 4),
        ('V006', 'KA-06-KL-2345', 'Cab', 4),
        ('V007', 'KA-07-MN-6789', 'Bus', 35),
        ('V008', 'KA-08-OP-0123', 'Bus', 45)
    ]
    cursor.executemany('INSERT INTO Vehicles VALUES (?, ?, ?, ?)', vehicles)
    
    # Insert Drivers
    drivers = [
        ('D001', 'Rajesh Kumar', '+91-9876543210'),
        ('D002', 'Amit Singh', '+91-9876543211'),
        ('D003', 'Priya Sharma', '+91-9876543212'),
        ('D004', 'Vijay Reddy', '+91-9876543213'),
        ('D005', 'Suresh Babu', '+91-9876543214'),
        ('D006', 'Lakshmi Devi', '+91-9876543215'),
        ('D007', 'Ramesh Patil', '+91-9876543216'),
        ('D008', 'Anita Desai', '+91-9876543217')
    ]
    cursor.executemany('INSERT INTO Drivers VALUES (?, ?, ?)', drivers)
    
    # Insert DailyTrips
    daily_trips = [
        ('T001', 'R001', 'North Corridor - Morning Shift - Trip 1', 85, '00:15 IN'),
        ('T002', 'R002', 'South Corridor - Evening Shift - Trip 1', 92, 'Scheduled'),
        ('T003', 'R001', 'North Corridor - Morning Shift - Trip 2', 78, '00:45 IN'),
        ('T004', 'R003', 'East Express - Morning - Trip 1', 95, '01:20 IN'),
        ('T005', 'R004', 'West Circular - Afternoon - Trip 1', 65, 'Scheduled'),
        ('T006', 'R006', 'North Corridor - Evening Return - Trip 1', 88, 'En Route'),
        ('T007', 'R007', 'South Corridor - Morning - Trip 1', 72, '00:30 IN'),
        ('T008', 'R003', 'East Express - Morning - Trip 2', 81, 'Scheduled')
    ]
    cursor.executemany('INSERT INTO DailyTrips VALUES (?, ?, ?, ?, ?)', daily_trips)
    
    # Insert Deployments
    deployments = [
        ('DP001', 'T001', 'V001', 'D001'),
        ('DP002', 'T002', 'V002', 'D002'),
        ('DP003', 'T003', 'V003', 'D003'),
        ('DP004', 'T004', 'V004', 'D004'),
        ('DP005', 'T005', 'V005', 'D005'),
        ('DP006', 'T006', 'V006', 'D006'),
        ('DP007', 'T007', 'V007', 'D007'),
        ('DP008', 'T008', None, None)  # Unassigned trip
    ]
    cursor.executemany('INSERT INTO Deployments VALUES (?, ?, ?, ?)', deployments)
    
    conn.commit()
    conn.close()

# API Endpoints

@app.route('/api/stops', methods=['GET'])
def get_stops():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM Stops')
    stops = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(stops)

@app.route('/api/paths', methods=['GET'])
def get_paths():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM Paths')
    paths = [dict(row) for row in cursor.fetchall()]
    # Parse JSON for ordered_list_of_stop_ids
    for path in paths:
        path['ordered_list_of_stop_ids'] = json.loads(path['ordered_list_of_stop_ids'])
    conn.close()
    return jsonify(paths)

@app.route('/api/routes', methods=['GET'])
def get_routes():
    status = request.args.get('status')
    conn = get_db()
    cursor = conn.cursor()
    if status:
        cursor.execute('SELECT * FROM Routes WHERE status = ?', (status,))
    else:
        cursor.execute('SELECT * FROM Routes')
    routes = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(routes)

@app.route('/api/routes/<route_id>', methods=['PUT'])
def update_route(route_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    
    # Build update query dynamically based on provided fields
    update_fields = []
    values = []
    
    if 'path_id' in data:
        update_fields.append('path_id = ?')
        values.append(data['path_id'])
    if 'route_display_name' in data:
        update_fields.append('route_display_name = ?')
        values.append(data['route_display_name'])
    if 'shift_time' in data:
        update_fields.append('shift_time = ?')
        values.append(data['shift_time'])
    if 'direction' in data:
        update_fields.append('direction = ?')
        values.append(data['direction'])
    if 'start_point' in data:
        update_fields.append('start_point = ?')
        values.append(data['start_point'])
    if 'end_point' in data:
        update_fields.append('end_point = ?')
        values.append(data['end_point'])
    if 'capacity' in data:
        update_fields.append('capacity = ?')
        values.append(data['capacity'])
    if 'allowed_waitlist' in data:
        update_fields.append('allowed_waitlist = ?')
        values.append(data['allowed_waitlist'])
    if 'status' in data:
        update_fields.append('status = ?')
        values.append(data['status'])
    
    if not update_fields:
        conn.close()
        return jsonify({'success': False, 'message': 'No fields to update'}), 400
    
    values.append(route_id)
    query = f'UPDATE Routes SET {", ".join(update_fields)} WHERE route_id = ?'
    cursor.execute(query, values)
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Route updated successfully'})

@app.route('/api/routes/<route_id>', methods=['DELETE'])
def delete_route(route_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM Routes WHERE route_id = ?', (route_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Route deleted successfully'})

@app.route('/api/routes', methods=['POST'])
def create_route():
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO Routes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['route_id'],
        data['path_id'],
        data['route_display_name'],
        data['shift_time'],
        data['direction'],
        data['start_point'],
        data['end_point'],
        data['capacity'],
        data['allowed_waitlist'],
        data.get('status', 'active')
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Route created successfully'})

@app.route('/api/vehicles', methods=['GET'])
def get_vehicles():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM Vehicles')
    vehicles = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(vehicles)

@app.route('/api/drivers', methods=['GET'])
def get_drivers():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM Drivers')
    drivers = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(drivers)

@app.route('/api/daily-trips', methods=['GET'])
def get_daily_trips():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT 
            dt.trip_id,
            dt.route_id,
            dt.display_name,
            dt.booking_status_percentage,
            dt.live_status,
            r.route_display_name as route_name,
            d.deployment_id,
            d.vehicle_id,
            d.driver_id,
            v.license_plate,
            v.type as vehicle_type,
            dr.name as driver_name,
            dr.phone_number as driver_phone
        FROM DailyTrips dt
        LEFT JOIN Routes r ON dt.route_id = r.route_id
        LEFT JOIN Deployments d ON dt.trip_id = d.trip_id
        LEFT JOIN Vehicles v ON d.vehicle_id = v.vehicle_id
        LEFT JOIN Drivers dr ON d.driver_id = dr.driver_id
        ORDER BY dt.display_name
    ''')
    trips = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(trips)

@app.route('/api/deployments', methods=['GET'])
def get_deployments():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM Deployments')
    deployments = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(deployments)

@app.route('/api/deployments/<deployment_id>', methods=['PUT'])
def update_deployment(deployment_id):
    data = request.json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE Deployments 
        SET vehicle_id = ?, driver_id = ?
        WHERE deployment_id = ?
    ''', (data.get('vehicle_id'), data.get('driver_id'), deployment_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Deployment updated successfully'})

@app.route('/api/deployments/<deployment_id>', methods=['DELETE'])
def delete_deployment(deployment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE Deployments 
        SET vehicle_id = NULL, driver_id = NULL
        WHERE deployment_id = ?
    ''', (deployment_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Deployment removed successfully'})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) as count FROM DailyTrips')
    total_trips = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM Vehicles')
    total_vehicles = cursor.fetchone()['count']
    
    cursor.execute('SELECT COUNT(*) as count FROM Drivers')
    total_drivers = cursor.fetchone()['count']
    
    conn.close()
    
    return jsonify({
        'total_trips': total_trips,
        'total_vehicles': total_vehicles,
        'total_drivers': total_drivers
    })

@app.route('/api/export/db', methods=['GET'])
def export_db():
    # Stream the SQLite database file for download
    return send_file(DATABASE, as_attachment=True, download_name='moveinsync.db')

@app.route('/src/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    """Serve audio files from frontend/src/audio directory"""
    audio_path = os.path.join('frontend', 'src', 'audio', filename)
    if os.path.exists(audio_path):
        return send_file(audio_path)
    return jsonify({'error': 'Audio file not found'}), 404

@app.route('/api/movi', methods=['POST'])
def movi_ingest():
    # Accept text/image/audio; process through Tribal Knowledge agent
    from movi.chat import run_movi_agent
    
    saved = {}
    response_message = ""
    needs_confirmation = False
    audio_url = None
    
    # Get user ID from session or generate one
    user_id = request.headers.get('X-User-ID', 'default_user')
    
    # Get current page context
    current_page = request.form.get('currentPage', 'busDashboard')
    
    # Save and process audio if present
    audio_path = None
    if 'audio' in request.files:
        audio_file = request.files['audio']
        if audio_file and audio_file.filename:
            filename = secure_filename(audio_file.filename)
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            name, ext = os.path.splitext(filename)
            final_name = f"{name}_{ts}{ext or '.wav'}"
            target_dir = os.path.join('frontend', 'src', 'audio')
            os.makedirs(target_dir, exist_ok=True)
            target_path = os.path.join(target_dir, final_name)
            audio_file.save(target_path)
            saved['audio'] = final_name
            audio_path = target_path

    # Save image if present
    image_path = None
    if 'image' in request.files:
        image_file = request.files['image']
        if image_file and image_file.filename:
            filename = secure_filename(image_file.filename)
            ts = datetime.now().strftime('%Y%m%d_%H%M%S')
            name, ext = os.path.splitext(filename)
            final_name = f"{name}_{ts}{ext or '.png'}"
            target_dir = os.path.join('frontend', 'src', 'images')
            os.makedirs(target_dir, exist_ok=True)
            target_path = os.path.join(target_dir, final_name)
            image_file.save(target_path)
            saved['image'] = final_name
            image_path = target_path

    # Capture text if present
    text_value = request.form.get('text', '').strip()
    
    # Determine message type and process through agent
    message_type = "text"
    if audio_path:
        message_type = "audio"
    elif image_path:
        message_type = "image"
    
    # Process through chat agent
    try:
        thread_id_input = request.form.get("thread_id")
        result = run_movi_agent(
            user_id=user_id,
            message_type=message_type,
            content=text_value,
            audio_path=audio_path,
            image_path=image_path,
            current_page=current_page,
            thread_id=thread_id_input  # <-- pass the frontend-provided thread_id
        )
        response_message = result.get('response', 'I received your message.')
        needs_confirmation = result.get('needs_confirmation', False)
        thread_id_return = result.get('thread_id')  # always return thread_id

        # Handle TTS audio file
        tts_audio_path = result.get('audio_path')
        if tts_audio_path and os.path.exists(tts_audio_path):
            # Copy TTS audio to frontend audio directory
            tts_filename = os.path.basename(tts_audio_path)
            target_dir = os.path.join('frontend', 'src', 'audio')
            os.makedirs(target_dir, exist_ok=True)
            target_path = os.path.join(target_dir, f"{tts_filename}")
            import shutil
            shutil.copy2(tts_audio_path, target_path)
            audio_url = f"/src/audio/{os.path.basename(target_path)}"
            saved['tts_audio'] = f"+{os.path.basename(target_path)}"
    except Exception as e:
        print(f"[ERROR] Chat agent processing failed: {e}")
        import traceback
        traceback.print_exc()
        response_message = "I encountered an error. Please try again."
        thread_id_return = thread_id_input if 'thread_id_input' in locals() else None

    return jsonify({
        'success': True,
        'saved': saved,
        'response': response_message,
        'needs_confirmation': needs_confirmation,
        'audio_url': audio_url,
        'thread_id': thread_id_return,  # Return thread_id in response always
    })

if __name__ == '__main__':
    if not os.path.exists(DATABASE):
        print("Database not found. Initializing and seeding...")
        print("Database ready!")
    else:
        print("Existing database found. Skipping initialization.")
    print("\nStarting Flask server...")
    print("API will be available at http://localhost:5000")
    print("\nAvailable endpoints:")
    print("  GET  /api/stops")
    print("  GET  /api/paths")
    print("  GET  /api/routes?status=active")
    print("  POST /api/routes")
    print("  PUT  /api/routes/<route_id>")
    print("  DELETE /api/routes/<route_id>")
    print("  GET  /api/vehicles")
    print("  GET  /api/drivers")
    print("  GET  /api/daily-trips")
    print("  GET  /api/deployments")
    print("  PUT  /api/deployments/<deployment_id>")
    print("  DELETE /api/deployments/<deployment_id>")
    print("  GET  /api/stats")
    print("  GET  /api/export/db")
    
    app.run(debug=True, port=5000)