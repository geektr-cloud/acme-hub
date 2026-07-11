package schedule

import "time"

// RenewRatio is the fraction of certificate lifetime at which renewal is triggered.
const RenewRatio = 0.9

// RenewAt calculates the time at which a certificate should be renewed.
func RenewAt(notBefore, notAfter time.Time) time.Time {
	lifetime := notAfter.Sub(notBefore)
	if lifetime <= 0 {
		return notBefore
	}
	return notBefore.Add(time.Duration(float64(lifetime) * RenewRatio))
}

// RequeueAfter determines whether a certificate needs renewal and how long to wait.
// Returns (true, 0) if renewal is needed now, or (false, duration until renewal).
func RequeueAfter(notBefore, notAfter, now time.Time) (renew bool, after time.Duration) {
	lifetime := notAfter.Sub(notBefore)
	if lifetime <= 0 {
		return true, 0
	}
	if now.After(notAfter) || now.Equal(notAfter) {
		return true, 0
	}
	renewTime := RenewAt(notBefore, notAfter)
	if !now.Before(renewTime) {
		return true, 0
	}
	return false, renewTime.Sub(now)
}
