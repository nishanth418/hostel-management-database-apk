-- ==========================================================
-- Hostel Management System - Original Database Seed Records
-- Authentic Original Records for all 18 Tables
-- ==========================================================

-- 1. WARDEN
INSERT INTO WARDEN (WardenID, WardenName, Email, JoiningDate) VALUES
('W101', 'Dr. Rajesh Kumar', 'rajesh.k@univ.edu', '15-JUN-18'),
('W102', 'Prof. Anita Sharma', 'anita@univ.edu', '01-AUG-19'),
('W103', 'Dr. Suresh Menon', 'suresh.m@univ.edu', '10-JAN-20'),
('W104', 'Prof. Priya Nair', 'priya.n@univ.edu', '20-JUL-21'),
('W105', 'Dr. Amit Verma', 'amit.v@univ.edu', '05-MAR-22');

-- 2. WARDEN_PHONE
INSERT INTO WARDEN_PHONE (WardenID, PhoneNo) VALUES
('W101', '9876500001'),
('W101', '9876500002'),
('W102', '9876500003'),
('W103', '9876500004'),
('W104', '9876500005');

-- 3. HOSTEL
INSERT INTO HOSTEL (HostelID, HostelName, TotalFloors, WardenID) VALUES
('H1', 'Cauvery Boys Hostel', 4, 'W101'),
('H2', 'Ganga Girls Hostel', 4, 'W102'),
('H3', 'Yamuna Boys Hostel', 3, 'W103'),
('H4', 'Krishna Girls Hostel', 3, 'W104'),
('H5', 'Narmada PG Hostel', 2, 'W105');

-- 4. ROOM_TYPE
INSERT INTO ROOM_TYPE (TypeID, TypeName, AC_Type, Capacity) VALUES
('RT1', 'Single', 'AC', 1),
('RT2', 'Double', 'Non-AC', 2),
('RT3', 'Triple', 'Non-AC', 3);

-- 5. ROOM
INSERT INTO ROOM (RoomNo, FloorNo, Type, Capacity, RoomRent, HostelID) VALUES
('R101', 1, 'Single AC', 1, 5000, 'H1'),
('R102', 1, 'Double Non-AC', 2, 4000, 'H1'),
('R201', 2, 'Triple Non-AC', 3, 3500, 'H2'),
('R202', 2, 'Double Non-AC', 2, 4000, 'H3'),
('R301', 3, 'Single AC', 1, 5000, 'H4');

-- 8. MESS (Created before student since student references mess)
INSERT INTO MESS (MessID, MessName, MessType, Location) VALUES
('M1', 'North Dining Hall', 'Pure Veg', 'North Campus Block A'),
('M2', 'South Dining Hall', 'Non-Veg Special', 'South Campus Block B'),
('M3', 'Central Mess', 'Mixed', 'Central Plaza Block C'),
('M4', 'Executive Dining', 'Continental', 'Guest House Block D'),
('M5', 'Fast Food and Snacks', 'Quick Bites', 'Student Activity Center');

-- 9. MESS_CONTACT
INSERT INTO MESS_CONTACT (MessID, ContactNo) VALUES
('M1', '044-220011'),
('M1', '044-220012'),
('M2', '044-220021'),
('M3', '044-220031'),
('M4', '044-220041');

-- 6. STUDENT
-- Insert parent students first (null MentorStudentID), then students with mentors
INSERT INTO STUDENT (StudentID, FirstName, LastName, Gender, DOB, Email, BloodGroup, AllergyInfo, PlanType, RoomNo, HostelID, MessID, MentorStudentID) VALUES
('S1001', 'Rahul', 'Sharma', 'Male', '12-04-2003', 'rahul.s@univ.edu', 'B+', 'None', 'Premium', 'R101', 'H1', 'M1', NULL),
('S1002', 'Sneha', 'Patel', 'Female', '25-08-2004', 'sneha.p@univ.edu', 'O+', 'None', 'Standard', 'R201', 'H2', 'M2', NULL);

INSERT INTO STUDENT (StudentID, FirstName, LastName, Gender, DOB, Email, BloodGroup, AllergyInfo, PlanType, RoomNo, HostelID, MessID, MentorStudentID) VALUES
('S1003', 'Rohan', 'Verma', 'Male', '15-01-2005', 'rohan.v@univ.edu', 'A+', 'None', 'Standard', 'R102', 'H1', 'M1', 'S1001'),
('S1004', 'Ananya', 'Iyer', 'Female', '30-09-2005', 'ananya.i@univ.edu', 'AB+', 'Lactose', 'Standard', 'R201', 'H2', 'M2', 'S1002'),
('S1005', 'Vikram', 'Singh', 'Male', '05-11-2004', 'vikram.s@univ.edu', 'B-', 'Dust', 'Premium', 'R202', 'H3', 'M3', 'S1001');

-- 7. STUDENT_PHONE
INSERT INTO STUDENT_PHONE (StudentID, PhoneNo) VALUES
('S1001', '9876543210'),
('S1001', '9876543211'),
('S1002', '9876543212'),
('S1003', '9876543213'),
('S1004', '9876543214'),
('S1005', '9876543215');

-- 10. MEAL
INSERT INTO MEAL (MealID, MealName, Description, Cost, MessID) VALUES
('ML1', 'North Indian Thali', 'Roti, Dhal Makhni, Paneer, Rice', 120, 'M1'),
('ML2', 'South Indian Meals', 'Sambhar, Rasam, Curd Rice, Pori, Payasam', 90, 'M1'),
('ML3', 'Chicken Biryani', 'Chicken Dum Biryani, Raita', 180, 'M2'),
('ML4', 'Continental Breakfast', 'Toast, Omlette, Juice, Coffee', 150, 'M4'),
('ML5', 'Mini Executive Thali', 'Chapati, Mixed Veg Curry, Pulao', 110, 'M3');

-- 11. STAFF
INSERT INTO STAFF (StaffID, StaffName, JoinDate, Salary, Role, MessID) VALUES
('ST1', 'Ramesh Chandra', '01-FEB-19', 35000, 'Head Chef', 'M1'),
('ST2', 'Murugan P.', '15-MAY-20', 28000, 'Assistant Cook', 'M1'),
('ST3', 'Joseph D''souza', '10-NOV-18', 38000, 'Master Chef', 'M2'),
('ST4', 'Sunita Devi', '01-AUG-21', 18000, 'Cleaner', 'M2'),
('ST5', 'Govind Ram', '20-JAN-22', 22000, 'Store Keeper', 'M3');

-- 12. STAFF_PHONE
INSERT INTO STAFF_PHONE (StaffID, PhoneNo) VALUES
('ST1', '9444100001'),
('ST2', '9444100002'),
('ST3', '9444100003'),
('ST3', '9444100004'),
('ST4', '9444100005');

-- 13. SUPPLIER
INSERT INTO SUPPLIER (SupplierID, SupplierName) VALUES
('SUP1', 'Fresh Farm Provisions'),
('SUP2', 'Metro Dairy Products'),
('SUP3', 'Coastal Poultry & Meats'),
('SUP4', 'National Grain Traders'),
('SUP5', 'Green Valley Vegetables');

-- 14. SUPPLIER_PHONE
INSERT INTO SUPPLIER_PHONE (SupplierID, PhoneNo) VALUES
('SUP1', '9884011111'),
('SUP2', '9884022222'),
('SUP3', '9884033333'),
('SUP3', '9884033334'),
('SUP4', '9884044444');

-- 15. INVENTORY_ITEM
INSERT INTO INVENTORY_ITEM (ItemID, ItemName, Category, Unit) VALUES
('IT101', 'Basmati Rice', 'Grains', 'Kg'),
('IT102', 'Toned Milk', 'Dairy', 'Litre'),
('IT103', 'Refined Sunflower Oil', 'Cooking Oil', 'Litre'),
('IT104', 'Fresh Broiler Chicken', 'Meat', 'Kg'),
('IT105', 'Potato', 'Vegetables', 'Kg');

-- 16. PROCURES
INSERT INTO PROCURES (MessID, SupplierID, ItemID, Quantity) VALUES
('M1', 'SUP4', 'IT101', 500),
('M1', 'SUP2', 'IT102', 200),
('M2', 'SUP3', 'IT104', 150),
('M2', 'SUP1', 'IT105', 300),
('M3', 'SUP4', 'IT103', 100);

-- 17. PAYMENT
INSERT INTO PAYMENT (PaymentID, StudentID, Amount, PaymentMode, Status, PaymentDay, PaymentMonth, PaymentYear) VALUES
('PAY1001', 'S1001', 12500, 'NetBanking', 'Successful', 5, 8, 2026),
('PAY1002', 'S1002', 14000, 'UPI', 'Successful', 6, 8, 2026),
('PAY1003', 'S1003', 11000, 'Credit Card', 'Successful', 7, 8, 2026),
('PAY1004', 'S1004', 11000, 'UPI', 'Pending', 10, 8, 2026),
('PAY1005', 'S1005', 15000, 'Debit Card', 'Successful', 12, 8, 2026);

-- 18. PAYMENT_DETAIL
INSERT INTO PAYMENT_DETAIL (PaymentID, DetailID, Month, Year, MessCharges, OtherCharges) VALUES
('PAY1001', 'D1', 'August', 2026, 11500, 1000),
('PAY1002', 'D1', 'August', 2026, 13000, 1000),
('PAY1003', 'D1', 'August', 2026, 10000, 1000),
('PAY1003', 'D2', 'July (Arrears)', 2026, 0, 1000),
('PAY1005', 'D1', 'August', 2026, 14000, 1000);
