-- Migration: give each room a wing - the men's side or the women's side.
-- Rooms created before this stay NULL ("not set"): they accept any occupant and stay
-- visible to both home deans until an admin assigns them a wing from the Rooms page.

ALTER TABLE rooms
  ADD COLUMN gender ENUM('male', 'female') NULL AFTER room_type;
