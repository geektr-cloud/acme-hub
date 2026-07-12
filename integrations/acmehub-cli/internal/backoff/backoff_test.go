package backoff

import (
	"testing"
	"time"
)

func TestDelaySequence(t *testing.T) {
	cases := []struct {
		attempt int
		want    time.Duration
	}{
		{0, 36 * time.Second},
		{1, 72 * time.Second},
		{2, 144 * time.Second},
		{3, 288 * time.Second},
		{-1, 36 * time.Second}, // negative treated as 0
	}
	for _, tc := range cases {
		if got := Delay(tc.attempt); got != tc.want {
			t.Errorf("Delay(%d) = %s, want %s", tc.attempt, got, tc.want)
		}
	}
}

func TestDelayCap(t *testing.T) {
	// 36s doubles: 36,72,144,288,576,1152,2304,4608,9216(=2.56h),18432(>3h cap)
	for attempt := 9; attempt < 20; attempt++ {
		if got := Delay(attempt); got != Max {
			t.Errorf("Delay(%d) = %s, want capped %s", attempt, got, Max)
		}
	}
}
