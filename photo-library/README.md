# Проверка изображений

Каталог: `recipes-photo-registry.csv`. Поисковые ссылки и AI-задания не являются фотографиями.

Фотографии кладутся в `photo-library/images/`. Решения записываются в `curated-images.json` с полями `recipe_id`, `source_type` (`real` / `ai`), `image_path`, `visual_verified`, `rights_verified`.

Для `real` обязательны `source_url`, `license_evidence_url`, `author`; для `ai` обязательны `generation_note` и `checked_against_ingredients`.

Запуск `python3 photo-library/validate_curated.py` проверяет наличие изображения, его принадлежность рецепту в реестре и основания для допуска; выводит `approved-images.json`. Никаких изменений на сайте до отдельного тестирования.
