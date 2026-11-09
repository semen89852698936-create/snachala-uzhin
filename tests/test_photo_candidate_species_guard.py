import unittest
from scripts.photo_candidate_species_guard import risky_candidates

class PhotoCandidateSpeciesGuardTests(unittest.TestCase):
    def test_pork_recipe_chicken_url_is_flagged(self):
        data = {"sources": [{"n":30, "recipe_id":"collection-meat-02-02", "recipe_title":"Свиная вырезка с грибами", "source_page":"https://www.pexels.com/photo/chicken-meat-dish-792027/"}]}
        self.assertEqual(risky_candidates(data)[0]["n"], 30)

    def test_matching_chicken_recipe_not_flagged(self):
        data = {"sources": [{"n":1, "recipe_id":"chicken-1", "recipe_title":"Курица с грибами", "source_page":"https://www.pexels.com/photo/chicken-meat-dish-792027/"}]}
        self.assertEqual(risky_candidates(data), [])

if __name__ == "__main__":
    unittest.main()
