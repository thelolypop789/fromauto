-- prep.events kept the CHECK from 20261016210000 that allows only visit, buy_view and free_limit. Every event added later
-- (level_view, readiness_view, subtopic_pick, promo_apply, scoredist_view, board_view, install_*, summary_view) passed
-- prep_track's own name list and then failed on insert; the client ignores analytics errors, so the admin "ฟีเจอร์ใหม่ใช้จริงไหม"
-- table read "ยังไม่มีคนใช้" for all of them. prep_track is the only writer and already validates the name, so the table no
-- longer keeps a second list that can drift.
alter table prep.events drop constraint events_name_check;
