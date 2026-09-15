import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from story_memory import assign_story_identity, plan_records, topic_similarity


class StoryMemoryTests(unittest.TestCase):
    def test_changed_rate_is_same_story_but_an_update(self):
        manifest = {"days": [{
            "date": "2026-09-11",
            "plan": [{
                "storyId": "story-rate",
                "event": "Bank of Canada holds policy rate at 3%",
                "owner": "markets",
                "firstSeen": "2026-09-11",
            }],
        }]}
        story = {"event": "Bank of Canada cuts policy rate to 2.75%", "owner": "markets"}
        plan = {"markets": {"owns": [story], "callbacks": [], "elsewhere": [], "context": []}}
        assign_story_identity(plan, manifest, "2026-09-14")
        self.assertEqual(story["storyId"], "story-rate")
        self.assertEqual(story["status"], "UPDATE")
        self.assertEqual(story["firstSeen"], "2026-09-11")
        self.assertIn("3%", story["whatChanged"])
        self.assertIn("2.75%", story["whatChanged"])

    def test_unrelated_story_gets_new_identity(self):
        manifest = {"days": [{"date": "2026-09-11", "plan": [
            {"event": "Bank of Canada holds policy rate at 3%", "owner": "markets"}
        ]}]}
        story = {"event": "Winnipeg opens a new rapid transit station", "owner": "manitoba"}
        plan = {"manitoba": {"owns": [story], "callbacks": [], "elsewhere": [], "context": []}}
        assign_story_identity(plan, manifest, "2026-09-14")
        self.assertEqual(story["status"], "NEW")
        self.assertTrue(story["storyId"].startswith("story-"))

    def test_topic_similarity_ignores_action_and_number_changes(self):
        score = topic_similarity(
            "Bank of Canada holds policy rate at 3%",
            "Bank of Canada cuts policy rate to 2.75%",
        )
        self.assertGreaterEqual(score, 0.63)

    def test_plan_records_preserves_update_metadata(self):
        story = {
            "storyId": "story-1", "event": "Fixture", "status": "UPDATE",
            "firstSeen": "2026-09-10", "lastSeen": "2026-09-14", "whatChanged": "new fact",
        }
        plan = {"markets": {"owns": [story], "callbacks": [], "elsewhere": [], "context": []}}
        record = plan_records(plan)[0]
        self.assertEqual(record["owner"], "markets")
        self.assertEqual(record["storyId"], "story-1")
        self.assertEqual(record["status"], "UPDATE")


if __name__ == "__main__":
    unittest.main()
