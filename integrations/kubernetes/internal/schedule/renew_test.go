package schedule

import (
	"testing"
	"time"
)

func TestRenewAt(t *testing.T) {
	nb := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	na := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC) // 90 days
	got := RenewAt(nb, na)
	want := nb.Add(time.Duration(float64(90*24*time.Hour) * RenewRatio))
	if !got.Equal(want) {
		t.Errorf("RenewAt = %v, want %v", got, want)
	}
}

func TestRenewAt_ZeroLifetime(t *testing.T) {
	now := time.Now()
	got := RenewAt(now, now)
	if !got.Equal(now) {
		t.Errorf("RenewAt with zero lifetime = %v, want %v", got, now)
	}
}

func TestRequeueAfter_NotYet(t *testing.T) {
	nb := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	na := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC) // 90 days
	now := nb.Add(30 * 24 * time.Hour)                // day 30 of 90

	renew, after := RequeueAfter(nb, na, now)
	if renew {
		t.Error("should not need renewal at day 30")
	}
	expectedAfter := RenewAt(nb, na).Sub(now)
	if after != expectedAfter {
		t.Errorf("RequeueAfter = %v, want %v", after, expectedAfter)
	}
}

func TestRequeueAfter_ExactlyAtRenew(t *testing.T) {
	nb := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	na := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)
	now := RenewAt(nb, na)

	renew, after := RequeueAfter(nb, na, now)
	if !renew {
		t.Error("should need renewal at exactly renewAt")
	}
	if after != 0 {
		t.Errorf("after should be 0, got %v", after)
	}
}

func TestRequeueAfter_Expired(t *testing.T) {
	nb := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	na := time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC)
	now := na.Add(time.Hour)

	renew, after := RequeueAfter(nb, na, now)
	if !renew {
		t.Error("should need renewal when expired")
	}
	if after != 0 {
		t.Errorf("after should be 0, got %v", after)
	}
}

func TestRequeueAfter_ZeroLifetime(t *testing.T) {
	now := time.Now()
	renew, after := RequeueAfter(now, now, now)
	if !renew {
		t.Error("should need renewal with zero lifetime")
	}
	if after != 0 {
		t.Errorf("after should be 0, got %v", after)
	}
}
