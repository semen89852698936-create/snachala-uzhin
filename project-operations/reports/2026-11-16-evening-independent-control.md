# Независимый контроль · 2026-11-16 18:02 Asia/Jerusalem

## Проверено по подключённым GitHub и Vercel
- Единый реестр `project-operations/registry.json` (main): ровно два active проекта: `snachala-uzhin`, `moi-granitsy`.
- PR #12 открыт, поэтому прочитан `CURRENT_STATE.md` ветки `operations/persistent-state-and-data-plan-20261102`; также прочитан main. Исторические утверждения документа не подменяют live.
- `snachala-uzhin` main HEAD `b5fe110097748be7933ac0d574ebd64015f9b417` (коммит от 13 ноября).
- PR #265 draft, открытый: 20 замен рецептов (17 мясо, 2 птица, 1 овощи), 20 WebP, 1001 ID сохраняются по заявлению PR. Его CI PASS по сообщению PR; этот контроль не запускал повторно. Не объединять без отдельного разрешения.
- Vercel `snachala-uzhin-preview`: свежая READY-сборка `dpl_AFHYdpKEC3h5gDaxUkSPwsNWDyUN`, SHA `c9e38ac14d97a16fa3e8ef990ffd6cc47f8cd565`, `target=null`, ветка `fix/catalog-remove-back-anchor-flowers-20261116`. Она не доказывает публикацию основного домена. По hostname lookup получен тот же preview deployment, не доказательство production alias.
- `moi-granitsy` main HEAD `6c0fac72f5e894b7693092a6ba0ec6380ad8c153`; Vercel `granitsy-semen-chayka` production READY `dpl_6banGij2M62bmzdG6GCPNL2gQDnV` на том же SHA. Более поздний preview READY `09030a5c` в ветке `snachala-uzhin-site` не является production.
- Платёжный сценарий, российская доступность и пользовательские браузерные тесты не проверены.

## Фото: различать историческую запись и нынешнюю базу
- `photo-library/summary.json` от 1 ноября: 1001 рецепт, 3 исторически окончательно одобренных файла и 10 кандидатов; это устаревший срез, не современная приёмка.
- `photo-library/curated-images.json` от 1 ноября: 10 ссылок-кандидатов, все `photo_downloaded=false`, `visually_approved=false`, `publication_approved=false`.
- `photo-library/recipes-photo-registry.csv` отсутствует в main и ветке PR #12 (404).
- Следующая историческая очередь №21–23 не должна автоматически подменять уже опубликованные и одобренные AI-фото. Не создавать повторно картинки, пока не сверен текущий `ai-recipe-photo-map.json` и PR #265.
- В этом запуске: создано WebP **0**, визуально проверено **0**, юридически подтверждено **0**, новых одобрений **0**. Число оставшихся до редакционной приёмки из 1001 **не установлено**. Нельзя вычитать старые 3 из 1001 как актуальный остаток.

## Следующее безопасное действие
1. Не дублировать PR #265 и часовую автоматизацию. Сверить новые 20 ID/asset SHA с актуальной фото-картой и неизменностью утверждённого дизайна, без слияния.
2. Установить точное назначение публичного alias по Vercel domains/aliases, затем browser QA без публикации.
3. Для «Моих границ» провести read-only проверку домена и доступности из РФ; не активировать оплату.

Никаких изменений production, платежей, прав, файлов дизайна или изображений в этом контрольном коммите.
