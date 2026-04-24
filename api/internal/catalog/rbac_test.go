package catalog

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/BohdanRohalskyi/bookit/api/internal/domain/identity"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// assertDenied checks that err signals an access denial (any of the three denial
// sentinels — all map to 403 at the HTTP layer).
func assertDenied(t *testing.T, err error) {
	t.Helper()
	denied := errors.Is(err, ErrNotOwner) || errors.Is(err, ErrNotProvider) || errors.Is(err, ErrLocationNotOwner)
	assert.True(t, denied, "expected access denied, got: %v", err)
}

// ─── DB connection ────────────────────────────────────────────────────────────

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://bookit:bookit@localhost:5432/bookit?sslmode=disable"
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	require.NoError(t, err, "failed to connect to test DB — is docker-compose up?")
	t.Cleanup(pool.Close)
	return pool
}

// ─── Fixture ─────────────────────────────────────────────────────────────────

type rbacFixture struct {
	svc               *CatalogService
	catalogRepo       *CatalogRepository
	ownerUserID       int64
	adminUserID       int64 // business-wide administrator
	scopedAdminUserID int64 // administrator restricted to location1 only
	staffUserID       int64
	strangerUserID    int64
	businessID        int64
	location1ID       int64
	location2ID       int64
}

func seedRBACFixture(t *testing.T, db *pgxpool.Pool) rbacFixture {
	t.Helper()
	ctx := context.Background()
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())

	identityRepo := identity.NewRepository(db)
	bizRepo := NewRepository(db)
	catalogRepo := NewCatalogRepository(db)
	locationRepo := NewLocationRepository(db)

	// Owner
	ownerUser, err := identityRepo.Create(ctx, "owner-"+suffix+"@rbac.test", "hash", "Owner", "+37060000001")
	require.NoError(t, err)
	ownerProvider, err := identityRepo.CreateProvider(ctx, ownerUser.ID)
	require.NoError(t, err)

	// Business
	biz, err := bizRepo.Create(ctx, ownerProvider.ID, BusinessCreate{
		Name:     "RBAC Test Biz " + suffix,
		Category: "beauty",
	})
	require.NoError(t, err)

	// Locations
	loc1, err := locationRepo.Create(ctx, LocationCreate{
		BusinessID: biz.ID, Name: "Loc 1", Address: "A1", City: "Vilnius", Country: "LT", Timezone: "Europe/Vilnius",
	})
	require.NoError(t, err)
	loc2, err := locationRepo.Create(ctx, LocationCreate{
		BusinessID: biz.ID, Name: "Loc 2", Address: "A2", City: "Kaunas", Country: "LT", Timezone: "Europe/Vilnius",
	})
	require.NoError(t, err)

	// Member users
	adminUser, err := identityRepo.Create(ctx, "admin-"+suffix+"@rbac.test", "hash", "Admin", "+37060000002")
	require.NoError(t, err)
	scopedAdminUser, err := identityRepo.Create(ctx, "scoped-"+suffix+"@rbac.test", "hash", "ScopedAdmin", "+37060000003")
	require.NoError(t, err)
	staffUser, err := identityRepo.Create(ctx, "staff-"+suffix+"@rbac.test", "hash", "Staff", "+37060000004")
	require.NoError(t, err)
	strangerUser, err := identityRepo.Create(ctx, "stranger-"+suffix+"@rbac.test", "hash", "Stranger", "+37060000005")
	require.NoError(t, err)

	// Role IDs
	var adminRoleID, staffRoleID int64
	require.NoError(t, db.QueryRow(ctx, `SELECT id FROM roles WHERE slug = 'administrator' AND is_system = true`).Scan(&adminRoleID))
	require.NoError(t, db.QueryRow(ctx, `SELECT id FROM roles WHERE slug = 'staff' AND is_system = true`).Scan(&staffRoleID))

	// Assignments
	_, err = db.Exec(ctx, `INSERT INTO user_role_assignments (user_id, role_id, business_id, location_id) VALUES ($1,$2,$3,NULL)`, adminUser.ID, adminRoleID, biz.ID)
	require.NoError(t, err)
	_, err = db.Exec(ctx, `INSERT INTO user_role_assignments (user_id, role_id, business_id, location_id) VALUES ($1,$2,$3,$4)`, scopedAdminUser.ID, adminRoleID, biz.ID, loc1.ID)
	require.NoError(t, err)
	_, err = db.Exec(ctx, `INSERT INTO user_role_assignments (user_id, role_id, business_id, location_id) VALUES ($1,$2,$3,NULL)`, staffUser.ID, staffRoleID, biz.ID)
	require.NoError(t, err)

	t.Cleanup(func() {
		c := context.Background()
		db.Exec(c, `DELETE FROM user_role_assignments WHERE user_id = ANY($1)`, []int64{adminUser.ID, scopedAdminUser.ID, staffUser.ID})           //nolint:errcheck
		db.Exec(c, `DELETE FROM locations WHERE id = ANY($1)`, []int64{loc1.ID, loc2.ID})                                                          //nolint:errcheck
		db.Exec(c, `DELETE FROM businesses WHERE id = $1`, biz.ID)                                                                                 //nolint:errcheck
		db.Exec(c, `DELETE FROM providers WHERE id = $1`, ownerProvider.ID)                                                                        //nolint:errcheck
		db.Exec(c, `DELETE FROM users WHERE id = ANY($1)`, []int64{ownerUser.ID, adminUser.ID, scopedAdminUser.ID, staffUser.ID, strangerUser.ID}) //nolint:errcheck
	})

	return rbacFixture{
		svc:               NewCatalogService(catalogRepo, bizRepo, identityRepo, locationRepo),
		catalogRepo:       catalogRepo,
		ownerUserID:       ownerUser.ID,
		adminUserID:       adminUser.ID,
		scopedAdminUserID: scopedAdminUser.ID,
		staffUserID:       staffUser.ID,
		strangerUserID:    strangerUser.ID,
		businessID:        biz.ID,
		location1ID:       loc1.ID,
		location2ID:       loc2.ID,
	}
}

// freshEquipment creates a new equipment item and registers cleanup.
func (f *rbacFixture) freshEquipment(t *testing.T, db *pgxpool.Pool) int64 {
	t.Helper()
	e, err := f.catalogRepo.CreateEquipment(context.Background(), EquipmentCreate{
		BusinessID: f.businessID, Name: "tmp-equip-" + t.Name(), QuantityActive: 1,
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		db.Exec(context.Background(), `DELETE FROM equipment WHERE id = $1`, e.ID) //nolint:errcheck
	})
	return e.ID
}

// ─── Tests ────────────────────────────────────────────────────────────────────

func TestCatalogRBAC(t *testing.T) {
	if testing.Short() {
		t.Skip("integration test — requires running Postgres")
	}

	db := testPool(t)
	f := seedRBACFixture(t, db)
	ctx := context.Background()

	// ── Business-level: ListEquipment ────────────────────────────────────────

	t.Run("ListEquipment/owner", func(t *testing.T) {
		_, err := f.svc.ListEquipment(ctx, f.ownerUserID, f.businessID)
		assert.NoError(t, err)
	})

	t.Run("ListEquipment/business-wide admin", func(t *testing.T) {
		_, err := f.svc.ListEquipment(ctx, f.adminUserID, f.businessID)
		assert.NoError(t, err)
	})

	t.Run("ListEquipment/location-scoped admin", func(t *testing.T) {
		_, err := f.svc.ListEquipment(ctx, f.scopedAdminUserID, f.businessID)
		assert.NoError(t, err)
	})

	t.Run("ListEquipment/staff can read", func(t *testing.T) {
		_, err := f.svc.ListEquipment(ctx, f.staffUserID, f.businessID)
		assert.NoError(t, err)
	})

	t.Run("ListEquipment/stranger denied", func(t *testing.T) {
		_, err := f.svc.ListEquipment(ctx, f.strangerUserID, f.businessID)
		assert.ErrorIs(t, err, ErrNotOwner)
	})

	// ── Business-level: CreateEquipment ──────────────────────────────────────

	createReq := func(suffix string) EquipmentCreate {
		return EquipmentCreate{BusinessID: f.businessID, Name: "equip-" + suffix, QuantityActive: 1}
	}

	t.Run("CreateEquipment/owner", func(t *testing.T) {
		e, err := f.svc.CreateEquipment(ctx, f.ownerUserID, createReq("owner"))
		require.NoError(t, err)
		t.Cleanup(func() { db.Exec(ctx, `DELETE FROM equipment WHERE id = $1`, e.ID) }) //nolint:errcheck
	})

	t.Run("CreateEquipment/business-wide admin", func(t *testing.T) {
		e, err := f.svc.CreateEquipment(ctx, f.adminUserID, createReq("biz-admin"))
		require.NoError(t, err)
		t.Cleanup(func() { db.Exec(ctx, `DELETE FROM equipment WHERE id = $1`, e.ID) }) //nolint:errcheck
	})

	t.Run("CreateEquipment/location-scoped admin", func(t *testing.T) {
		e, err := f.svc.CreateEquipment(ctx, f.scopedAdminUserID, createReq("scoped-admin"))
		require.NoError(t, err)
		t.Cleanup(func() { db.Exec(ctx, `DELETE FROM equipment WHERE id = $1`, e.ID) }) //nolint:errcheck
	})

	t.Run("CreateEquipment/staff denied", func(t *testing.T) {
		_, err := f.svc.CreateEquipment(ctx, f.staffUserID, createReq("staff"))
		assert.ErrorIs(t, err, ErrNotOwner)
	})

	t.Run("CreateEquipment/stranger denied", func(t *testing.T) {
		_, err := f.svc.CreateEquipment(ctx, f.strangerUserID, createReq("stranger"))
		assert.ErrorIs(t, err, ErrNotOwner)
	})

	// ── Business-level: DeleteEquipment ──────────────────────────────────────

	t.Run("DeleteEquipment/owner", func(t *testing.T) {
		id := f.freshEquipment(t, db)
		err := f.svc.DeleteEquipment(ctx, f.ownerUserID, id)
		require.NoError(t, err)
		require.NoError(t, f.catalogRepo.DeleteEquipment(ctx, id))
	})

	t.Run("DeleteEquipment/business-wide admin denied", func(t *testing.T) {
		id := f.freshEquipment(t, db)
		assertDenied(t, f.svc.DeleteEquipment(ctx, f.adminUserID, id))
	})

	t.Run("DeleteEquipment/location-scoped admin denied", func(t *testing.T) {
		id := f.freshEquipment(t, db)
		assertDenied(t, f.svc.DeleteEquipment(ctx, f.scopedAdminUserID, id))
	})

	t.Run("DeleteEquipment/staff denied", func(t *testing.T) {
		id := f.freshEquipment(t, db)
		assertDenied(t, f.svc.DeleteEquipment(ctx, f.staffUserID, id))
	})

	t.Run("DeleteEquipment/stranger denied", func(t *testing.T) {
		id := f.freshEquipment(t, db)
		assertDenied(t, f.svc.DeleteEquipment(ctx, f.strangerUserID, id))
	})

	// ── Location pivot: ListLocationEquipment ────────────────────────────────

	t.Run("ListLocationEquipment/owner", func(t *testing.T) {
		_, err := f.svc.ListLocationEquipment(ctx, f.ownerUserID, f.location1ID)
		assert.NoError(t, err)
	})

	t.Run("ListLocationEquipment/business-wide admin", func(t *testing.T) {
		_, err := f.svc.ListLocationEquipment(ctx, f.adminUserID, f.location1ID)
		assert.NoError(t, err)
	})

	t.Run("ListLocationEquipment/scoped admin on assigned location", func(t *testing.T) {
		_, err := f.svc.ListLocationEquipment(ctx, f.scopedAdminUserID, f.location1ID)
		assert.NoError(t, err)
	})

	t.Run("ListLocationEquipment/scoped admin denied on other location", func(t *testing.T) {
		_, err := f.svc.ListLocationEquipment(ctx, f.scopedAdminUserID, f.location2ID)
		assert.ErrorIs(t, err, ErrLocationNotOwner)
	})

	t.Run("ListLocationEquipment/stranger denied", func(t *testing.T) {
		_, err := f.svc.ListLocationEquipment(ctx, f.strangerUserID, f.location1ID)
		assert.ErrorIs(t, err, ErrNotOwner)
	})

	// ── Location pivot: AddLocationEquipment ─────────────────────────────────

	addLocEquip := func(userID, locationID int64) error {
		id := f.freshEquipment(t, db)
		_, err := f.svc.AddLocationEquipment(ctx, userID, locationID, LocationEquipmentCreate{EquipmentID: id, Quantity: 1})
		// best-effort cleanup of pivot row — location_equipment may have been inserted
		db.Exec(ctx, `DELETE FROM location_equipment WHERE location_id = $1 AND equipment_id = $2`, locationID, id) //nolint:errcheck
		return err
	}

	t.Run("AddLocationEquipment/owner", func(t *testing.T) {
		assert.NoError(t, addLocEquip(f.ownerUserID, f.location1ID))
	})

	t.Run("AddLocationEquipment/business-wide admin", func(t *testing.T) {
		assert.NoError(t, addLocEquip(f.adminUserID, f.location1ID))
	})

	t.Run("AddLocationEquipment/scoped admin on assigned location", func(t *testing.T) {
		assert.NoError(t, addLocEquip(f.scopedAdminUserID, f.location1ID))
	})

	t.Run("AddLocationEquipment/scoped admin denied on other location", func(t *testing.T) {
		assert.ErrorIs(t, addLocEquip(f.scopedAdminUserID, f.location2ID), ErrLocationNotOwner)
	})

	t.Run("AddLocationEquipment/staff denied", func(t *testing.T) {
		assert.ErrorIs(t, addLocEquip(f.staffUserID, f.location1ID), ErrLocationNotOwner)
	})

	t.Run("AddLocationEquipment/stranger denied", func(t *testing.T) {
		assert.ErrorIs(t, addLocEquip(f.strangerUserID, f.location1ID), ErrNotOwner)
	})
}
