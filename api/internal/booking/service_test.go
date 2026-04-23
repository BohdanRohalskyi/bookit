package booking

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGenerateSlots(t *testing.T) {
	t.Parallel()

	t.Run("generates correct slots for 60-minute service in 8-hour window", func(t *testing.T) {
		t.Parallel()
		slots := generateSlots("09:00", "17:00", 60, nil)
		assert.Len(t, slots, 8)
		assert.Equal(t, "09:00", slots[0].StartTime)
		assert.Equal(t, "10:00", slots[0].EndTime)
		assert.True(t, slots[0].Available)
		assert.Equal(t, "16:00", slots[7].StartTime)
		assert.Equal(t, "17:00", slots[7].EndTime)
	})

	t.Run("marks slot unavailable when already booked", func(t *testing.T) {
		t.Parallel()
		slots := generateSlots("09:00", "17:00", 60, []string{"10:00", "14:00"})
		assert.True(t, slots[0].Available)  // 09:00 free
		assert.False(t, slots[1].Available) // 10:00 booked
		assert.True(t, slots[2].Available)  // 11:00 free
		assert.False(t, slots[5].Available) // 14:00 booked
	})

	t.Run("returns nil when location is closed (empty open/close)", func(t *testing.T) {
		t.Parallel()
		slots := generateSlots("", "", 60, nil)
		assert.Empty(t, slots)
	})

	t.Run("last slot fits exactly at close time", func(t *testing.T) {
		t.Parallel()
		// 09:00-11:00 with 60-min → 09:00-10:00 and 10:00-11:00
		slots := generateSlots("09:00", "11:00", 60, nil)
		assert.Len(t, slots, 2)
		assert.Equal(t, "10:00", slots[1].StartTime)
		assert.Equal(t, "11:00", slots[1].EndTime)
	})

	t.Run("slot that would overflow close time is not generated", func(t *testing.T) {
		t.Parallel()
		// 09:00-10:30 with 60-min → only 09:00-10:00; 10:00+60=11:00 > 10:30
		slots := generateSlots("09:00", "10:30", 60, nil)
		assert.Len(t, slots, 1)
		assert.Equal(t, "09:00", slots[0].StartTime)
	})

	t.Run("30-minute service generates double the slots", func(t *testing.T) {
		t.Parallel()
		slots := generateSlots("09:00", "11:00", 30, nil)
		assert.Len(t, slots, 4) // 09:00, 09:30, 10:00, 10:30
	})

	t.Run("returns nil on malformed time strings", func(t *testing.T) {
		t.Parallel()
		slots := generateSlots("bad", "time", 60, nil)
		assert.Empty(t, slots)
	})
}
