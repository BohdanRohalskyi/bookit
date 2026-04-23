// Package main is a one-shot database seeder for the Bookit demo environment.
// Usage: DATABASE_URL=postgres://... go run ./cmd/seed
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const defaultPassword = "password"
const bcryptCost = 12

func main() {
	if err := run(); err != nil {
		slog.Error("seed failed", "error", err)
		os.Exit(1)
	}
	slog.Info("seed completed successfully")
}

func run() error {
	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping: %w", err)
	}
	slog.Info("connected to database")

	s := &seeder{db: pool, ctx: ctx}
	return s.seed()
}

type seeder struct {
	db  *pgxpool.Pool
	ctx context.Context
}

func (s *seeder) seed() error {
	hash, err := bcrypt.GenerateFromPassword([]byte(defaultPassword), bcryptCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	passwordHash := string(hash)

	// ── Users ────────────────────────────────────────────────────────────────

	slog.Info("creating users")
	bizUserID, err := s.createUser("business1@example.com", passwordHash, "Business Owner", "+37061000001")
	if err != nil {
		return fmt.Errorf("create business user: %w", err)
	}
	_, err = s.createUser("customer1@example.com", passwordHash, "Customer One", "+37061000002")
	if err != nil {
		return fmt.Errorf("create customer user: %w", err)
	}
	admin1ID, err := s.createUser("adminforloc1@example.com", passwordHash, "Admin Loc 1", "+37061000003")
	if err != nil {
		return fmt.Errorf("create admin1: %w", err)
	}
	admin2ID, err := s.createUser("adminforloc2@example.com", passwordHash, "Admin Loc 2", "+37061000004")
	if err != nil {
		return fmt.Errorf("create admin2: %w", err)
	}
	trainer1ID, err := s.createUser("trainerforloc1@example.com", passwordHash, "Trainer Loc 1", "+37061000005")
	if err != nil {
		return fmt.Errorf("create trainer1: %w", err)
	}
	trainer2ID, err := s.createUser("trainerforloc2@example.com", passwordHash, "Trainer Loc 2", "+37061000006")
	if err != nil {
		return fmt.Errorf("create trainer2: %w", err)
	}

	// ── Provider & Business ───────────────────────────────────────────────────

	slog.Info("creating provider and business")
	providerID, err := s.createProvider(bizUserID)
	if err != nil {
		return fmt.Errorf("create provider: %w", err)
	}
	description := "Premier sport facility in Vilnius offering personal training and group workouts."
	businessID, err := s.createBusiness(providerID, "Sport Business", "sport", &description)
	if err != nil {
		return fmt.Errorf("create business: %w", err)
	}

	// ── Locations ─────────────────────────────────────────────────────────────

	slog.Info("creating locations")
	phone1 := "+37061100001"
	email1 := "mainloc@sportbusiness.lt"
	loc1ID, err := s.createLocation(businessID, "Main Location", "Gedimino pr. 1", "Vilnius", "Lithuania", &phone1, &email1)
	if err != nil {
		return fmt.Errorf("create location 1: %w", err)
	}
	phone2 := "+37061100002"
	email2 := "downtown@sportbusiness.lt"
	loc2ID, err := s.createLocation(businessID, "Downtown Location", "Laisvės al. 10", "Vilnius", "Lithuania", &phone2, &email2)
	if err != nil {
		return fmt.Errorf("create location 2: %w", err)
	}

	// Set Mon–Fri 09:00–17:00 for both locations
	for _, locID := range []int64{loc1ID, loc2ID} {
		if err := s.setWeekdaySchedule(locID, "09:00", "17:00"); err != nil {
			return fmt.Errorf("set schedule for location %d: %w", locID, err)
		}
	}

	// ── Equipment ─────────────────────────────────────────────────────────────

	slog.Info("creating equipment")
	gymID, err := s.createEquipment(businessID, "Gym")
	if err != nil {
		return fmt.Errorf("create gym equipment: %w", err)
	}

	// Assign equipment to each location (1 unit each)
	for _, locID := range []int64{loc1ID, loc2ID} {
		if err := s.addLocationEquipment(locID, gymID, 1); err != nil {
			return fmt.Errorf("add gym to location %d: %w", locID, err)
		}
	}

	// ── Staff Roles (job-title catalog) ───────────────────────────────────────

	slog.Info("creating staff roles")
	adminRBACID, err := s.getRoleIDBySlug("administrator")
	if err != nil {
		return fmt.Errorf("get administrator role: %w", err)
	}
	staffRBACID, err := s.getRoleIDBySlug("staff")
	if err != nil {
		return fmt.Errorf("get staff role: %w", err)
	}

	adminStaffRoleID, err := s.createStaffRole(businessID, "Administrator", adminRBACID, true)
	if err != nil {
		return fmt.Errorf("create administrator staff role: %w", err)
	}
	trainerStaffRoleID, err := s.createStaffRole(businessID, "Trainer", staffRBACID, false)
	if err != nil {
		return fmt.Errorf("create trainer staff role: %w", err)
	}

	// Assign staff roles to locations
	for _, locID := range []int64{loc1ID, loc2ID} {
		if err := s.addLocationStaffRole(locID, adminStaffRoleID, 1); err != nil {
			return fmt.Errorf("add admin role to location %d: %w", locID, err)
		}
		if err := s.addLocationStaffRole(locID, trainerStaffRoleID, 1); err != nil {
			return fmt.Errorf("add trainer role to location %d: %w", locID, err)
		}
	}

	// ── Services ──────────────────────────────────────────────────────────────

	slog.Info("creating services")
	regularDesc := "Group workout session using the gym facilities."
	regularID, err := s.createService(businessID, "Regular Workout", &regularDesc, 60, 30.00, "EUR")
	if err != nil {
		return fmt.Errorf("create regular workout: %w", err)
	}
	// Regular workout: 1 Gym (equipment)
	if err := s.addServiceEquipmentReq(regularID, gymID, 1); err != nil {
		return fmt.Errorf("add gym req to regular workout: %w", err)
	}

	personalDesc := "One-on-one personal training session with a dedicated trainer."
	personalID, err := s.createService(businessID, "Personal Workout", &personalDesc, 60, 50.00, "EUR")
	if err != nil {
		return fmt.Errorf("create personal workout: %w", err)
	}
	// Personal workout: 1 Gym (equipment) + 1 Trainer (staff)
	if err := s.addServiceEquipmentReq(personalID, gymID, 1); err != nil {
		return fmt.Errorf("add gym req to personal workout: %w", err)
	}
	if err := s.addServiceStaffReq(personalID, trainerStaffRoleID, 1); err != nil {
		return fmt.Errorf("add trainer req to personal workout: %w", err)
	}

	// Link services to both locations
	for _, locID := range []int64{loc1ID, loc2ID} {
		if err := s.addLocationService(locID, regularID); err != nil {
			return fmt.Errorf("link regular workout to location %d: %w", locID, err)
		}
		if err := s.addLocationService(locID, personalID); err != nil {
			return fmt.Errorf("link personal workout to location %d: %w", locID, err)
		}
	}

	// ── Staff Assignments ─────────────────────────────────────────────────────

	slog.Info("assigning staff to locations")

	// Admin 1 → Location 1 (administrator RBAC, Administrator job title)
	if err := s.assignStaff(admin1ID, adminRBACID, businessID, &loc1ID, bizUserID); err != nil {
		return fmt.Errorf("assign admin1: %w", err)
	}
	if err := s.assignStaffRole(admin1ID, adminStaffRoleID, businessID, bizUserID); err != nil {
		return fmt.Errorf("assign admin1 staff role: %w", err)
	}
	if err := s.createMemberProfile(admin1ID, businessID, "Admin Loc 1"); err != nil {
		return fmt.Errorf("create profile for admin1: %w", err)
	}

	// Admin 2 → Location 2
	if err := s.assignStaff(admin2ID, adminRBACID, businessID, &loc2ID, bizUserID); err != nil {
		return fmt.Errorf("assign admin2: %w", err)
	}
	if err := s.assignStaffRole(admin2ID, adminStaffRoleID, businessID, bizUserID); err != nil {
		return fmt.Errorf("assign admin2 staff role: %w", err)
	}
	if err := s.createMemberProfile(admin2ID, businessID, "Admin Loc 2"); err != nil {
		return fmt.Errorf("create profile for admin2: %w", err)
	}

	// Trainer 1 → Location 1 (staff RBAC, Trainer job title)
	if err := s.assignStaff(trainer1ID, staffRBACID, businessID, &loc1ID, bizUserID); err != nil {
		return fmt.Errorf("assign trainer1: %w", err)
	}
	if err := s.assignStaffRole(trainer1ID, trainerStaffRoleID, businessID, bizUserID); err != nil {
		return fmt.Errorf("assign trainer1 staff role: %w", err)
	}
	if err := s.createMemberProfile(trainer1ID, businessID, "Trainer Loc 1"); err != nil {
		return fmt.Errorf("create profile for trainer1: %w", err)
	}

	// Trainer 2 → Location 2
	if err := s.assignStaff(trainer2ID, staffRBACID, businessID, &loc2ID, bizUserID); err != nil {
		return fmt.Errorf("assign trainer2: %w", err)
	}
	if err := s.assignStaffRole(trainer2ID, trainerStaffRoleID, businessID, bizUserID); err != nil {
		return fmt.Errorf("assign trainer2 staff role: %w", err)
	}
	if err := s.createMemberProfile(trainer2ID, businessID, "Trainer Loc 2"); err != nil {
		return fmt.Errorf("create profile for trainer2: %w", err)
	}

	slog.Info("seed data summary",
		"business", "Sport Business",
		"locations", 2,
		"services", 2,
		"staff", 4,
		"users_total", 6,
	)
	return nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (s *seeder) createUser(email, passwordHash, name, phone string) (int64, error) {
	var id int64
	err := s.db.QueryRow(s.ctx, `
		INSERT INTO users (email, password_hash, name, phone, email_verified)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (LOWER(email)) DO UPDATE SET name = EXCLUDED.name
		RETURNING id
	`, email, passwordHash, name, phone).Scan(&id)
	if err != nil {
		return 0, err
	}
	slog.Info("  user", "email", email, "id", id)
	return id, nil
}

func (s *seeder) createProvider(userID int64) (int64, error) {
	var id int64
	err := s.db.QueryRow(s.ctx, `
		INSERT INTO providers (user_id, status)
		VALUES ($1, 'active')
		ON CONFLICT (user_id) DO UPDATE SET status = 'active'
		RETURNING id
	`, userID).Scan(&id)
	return id, err
}

func (s *seeder) createBusiness(providerID int64, name, category string, description *string) (int64, error) {
	var id int64
	err := s.db.QueryRow(s.ctx, `
		INSERT INTO businesses (provider_id, name, category, description, is_active)
		VALUES ($1, $2, $3, $4, true)
		RETURNING id
	`, providerID, name, category, description).Scan(&id)
	if err != nil {
		return 0, err
	}
	slog.Info("  business", "name", name, "id", id)
	return id, nil
}

func (s *seeder) createLocation(businessID int64, name, address, city, country string, phone, email *string) (int64, error) {
	var id int64
	err := s.db.QueryRow(s.ctx, `
		INSERT INTO locations (business_id, name, address, city, country, phone, email, timezone, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'Europe/Vilnius', true)
		RETURNING id
	`, businessID, name, address, city, country, phone, email).Scan(&id)
	if err != nil {
		return 0, err
	}
	slog.Info("  location", "name", name, "id", id)
	return id, nil
}

func (s *seeder) setWeekdaySchedule(locationID int64, openTime, closeTime string) error {
	// Create schedule if not exists
	var schedID int64
	err := s.db.QueryRow(s.ctx,
		`INSERT INTO schedules (location_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id`,
		locationID).Scan(&schedID)
	if err != nil {
		// Fetch existing
		if err2 := s.db.QueryRow(s.ctx,
			`SELECT id FROM schedules WHERE location_id = $1`, locationID).Scan(&schedID); err2 != nil {
			return fmt.Errorf("get schedule: %w", err2)
		}
	}

	// Insert all 7 days, open Mon(0)–Fri(4), closed Sat(5)–Sun(6)
	for dow := 0; dow <= 6; dow++ {
		isOpen := dow < 5
		var open, close *string
		if isOpen {
			open = &openTime
			close = &closeTime
		}
		if _, err := s.db.Exec(s.ctx, `
			INSERT INTO schedule_days (schedule_id, day_of_week, is_open, open_time, close_time)
			VALUES ($1, $2, $3, $4::time, $5::time)
			ON CONFLICT (schedule_id, day_of_week) DO UPDATE
			SET is_open = EXCLUDED.is_open,
			    open_time = EXCLUDED.open_time,
			    close_time = EXCLUDED.close_time
		`, schedID, dow, isOpen, open, close); err != nil {
			return fmt.Errorf("upsert day %d: %w", dow, err)
		}
	}
	slog.Info("  schedule set", "location_id", locationID, "hours", fmt.Sprintf("Mon–Fri %s–%s", openTime, closeTime))
	return nil
}

func (s *seeder) createEquipment(businessID int64, name string) (int64, error) {
	var id int64
	err := s.db.QueryRow(s.ctx, `
		INSERT INTO equipment (business_id, name) VALUES ($1, $2) RETURNING id
	`, businessID, name).Scan(&id)
	if err != nil {
		return 0, err
	}
	slog.Info("  equipment", "name", name, "id", id)
	return id, nil
}

func (s *seeder) addLocationEquipment(locationID, equipmentID int64, quantity int) error {
	_, err := s.db.Exec(s.ctx, `
		INSERT INTO location_equipment (location_id, equipment_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (location_id, equipment_id) DO UPDATE SET quantity = EXCLUDED.quantity
	`, locationID, equipmentID, quantity)
	return err
}

func (s *seeder) getRoleIDBySlug(slug string) (int64, error) {
	var id int64
	err := s.db.QueryRow(s.ctx,
		`SELECT id FROM roles WHERE slug = $1 AND is_system = true`, slug).Scan(&id)
	return id, err
}

func (s *seeder) createStaffRole(businessID int64, jobTitle string, roleID int64, isSystem bool) (int64, error) {
	var id int64
	err := s.db.QueryRow(s.ctx, `
		INSERT INTO staff_roles (business_id, job_title, role_id, is_system)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, businessID, jobTitle, roleID, isSystem).Scan(&id)
	if err != nil {
		return 0, err
	}
	slog.Info("  staff role", "title", jobTitle, "id", id)
	return id, nil
}

func (s *seeder) addLocationStaffRole(locationID, staffRoleID int64, quantity int) error {
	_, err := s.db.Exec(s.ctx, `
		INSERT INTO location_staff_roles (location_id, staff_role_id, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT (location_id, staff_role_id) DO UPDATE SET quantity = EXCLUDED.quantity
	`, locationID, staffRoleID, quantity)
	return err
}

func (s *seeder) createService(businessID int64, name string, description *string, durationMin int, price float64, currency string) (int64, error) {
	var id int64
	err := s.db.QueryRow(s.ctx, `
		INSERT INTO services (business_id, name, description, duration_minutes, price, currency)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, businessID, name, description, durationMin, price, currency).Scan(&id)
	if err != nil {
		return 0, err
	}
	slog.Info("  service", "name", name, "id", id)
	return id, nil
}

func (s *seeder) addServiceEquipmentReq(serviceID, equipmentID int64, qty int) error {
	_, err := s.db.Exec(s.ctx, `
		INSERT INTO service_equipment_requirements (service_id, equipment_id, quantity_needed)
		VALUES ($1, $2, $3)
		ON CONFLICT (service_id, equipment_id) DO UPDATE SET quantity_needed = EXCLUDED.quantity_needed
	`, serviceID, equipmentID, qty)
	return err
}

func (s *seeder) addServiceStaffReq(serviceID, staffRoleID int64, qty int) error {
	_, err := s.db.Exec(s.ctx, `
		INSERT INTO service_staff_requirements (service_id, staff_role_id, quantity_needed)
		VALUES ($1, $2, $3)
		ON CONFLICT (service_id, staff_role_id) DO UPDATE SET quantity_needed = EXCLUDED.quantity_needed
	`, serviceID, staffRoleID, qty)
	return err
}

func (s *seeder) addLocationService(locationID, serviceID int64) error {
	_, err := s.db.Exec(s.ctx, `
		INSERT INTO location_services (location_id, service_id, is_active)
		VALUES ($1, $2, true)
		ON CONFLICT (location_id, service_id) DO UPDATE SET is_active = true
	`, locationID, serviceID)
	return err
}

func (s *seeder) assignStaff(userID, roleID, businessID int64, locationID *int64, assignedBy int64) error {
	_, err := s.db.Exec(s.ctx, `
		INSERT INTO user_role_assignments (user_id, role_id, business_id, location_id, assigned_by)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, role_id, business_id, location_id) DO NOTHING
	`, userID, roleID, businessID, locationID, assignedBy)
	return err
}

func (s *seeder) assignStaffRole(userID, staffRoleID, businessID, assignedBy int64) error {
	_, err := s.db.Exec(s.ctx, `
		INSERT INTO user_staff_role_assignments (user_id, staff_role_id, business_id, assigned_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, staff_role_id, business_id) DO NOTHING
	`, userID, staffRoleID, businessID, assignedBy)
	return err
}

func (s *seeder) createMemberProfile(userID, businessID int64, fullName string) error {
	_, err := s.db.Exec(s.ctx, `
		INSERT INTO business_member_profiles (user_id, business_id, full_name)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, business_id) DO UPDATE SET full_name = EXCLUDED.full_name
	`, userID, businessID, fullName)
	return err
}
