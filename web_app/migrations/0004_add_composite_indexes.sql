-- Add composite indexes for frequently queried column combinations

-- medicine_dose_logs: queried by (medicine_id, date) on every VitalsZone load
CREATE INDEX IF NOT EXISTS idx_dose_logs_medicine_date ON medicine_dose_logs(medicine_id, date);

-- water_logs: queried by (user_id, date) and (card_id, date)
CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_logs(user_id, date);

-- food_items: queried by (user_id, date) and (card_id, date)
CREATE INDEX IF NOT EXISTS idx_food_user_date ON food_items(user_id, date);

-- schedule_events: queried by (user_id, date)
CREATE INDEX IF NOT EXISTS idx_schedule_user_date ON schedule_events(user_id, date);

-- habit_logs: queried by (habit_id, date)
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date);
