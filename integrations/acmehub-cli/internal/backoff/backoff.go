package backoff

import "time"

// Base and Max define the exponential retry schedule for failed fetches,
// mirroring the k8s syncer: 36s doubling up to a 3h cap.
const (
	Base = 36 * time.Second
	Max  = 3 * time.Hour
)

// Delay returns the backoff duration for a given zero-based attempt number.
// attempt 0 -> Base, attempt 1 -> 2*Base, ... capped at Max. Negative attempts
// are treated as 0.
func Delay(attempt int) time.Duration {
	if attempt < 0 {
		attempt = 0
	}
	d := Base
	for i := 0; i < attempt; i++ {
		d *= 2
		if d >= Max {
			return Max
		}
	}
	if d > Max {
		return Max
	}
	return d
}
