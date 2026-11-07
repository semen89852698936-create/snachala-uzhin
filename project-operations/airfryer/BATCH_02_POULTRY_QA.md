# Аэрогриль - партия 02: птица (рецепты 11–20)

**Дата:** 07.11.2026  
**Статус:** 10 полных редакционных черновиков, источники проверены, фото отсутствуют, физические испытания не заявлены, на сайт не опубликованы.

## Состав партии

| № | Рецепт | Режим-ориентир | Основной источник |
|---:|---|---|---|
| 11 | Куриное филе со шпинатом и моцареллой | 190 °C, 25–30 мин | The Oregon Dietitian |
| 12 | Медальоны из индейки с клюквенно-апельсиновым соусом | 185 °C, 12–15 мин | Recipes Airfryer + Muscle & Fitness |
| 13 | Утиная грудка с апельсиновым соусом | 195 °C 5 мин, затем 160 °C 10–12 мин | Love Food Not Cooking |
| 14 | Курица пармезан с томатным соусом и моцареллой | 190 °C, 12–15 мин | A Healthier Michigan |
| 15 | Кёфта из индейки с кумином и мятой | 180 °C, 16–20 мин | Samsung Food / Clare Andrews |
| 16 | Куриные бёдра в мягком карри-соусе | 190 °C, 12–16 мин для курицы; соус отдельно | Schwartz UK |
| 17 | Домашний кордон-блю из курицы | 180 °C, 18–20 мин | Taste France + RTE |
| 18 | Домашние колбаски из индейки с яблоком и шалфеем | 200 °C, 8–10 мин | Delish + The Real Food Dietitians |
| 19 | Куриные четверти с лимоном, чесноком и тимьяном | 200 °C, 35–40 мин | Samsung Food |
| 20 | Куриные фахитас с перцем и красным луком | 200 °C, 12–15 мин | AirFryersRecipe |

Полные граммовки, шаги, загрузка, переворот, критерии готовности, фото-брифы и источники находятся в `data/airfryer-recipes-batch-02.json`.

## Технологические замечания

- **Утиная грудка:** источник рекомендует двухступенчатый режим 195 °C → 160 °C и отдельно предупреждает о большом количестве вытопленного жира. Для безопасной версии проекта зафиксирован внутренний ориентир 74 °C, то есть грудка полностью приготовлена, не розовая.
- **Куриное карри:** исходный рецепт Schwartz готовится в глубокой жаропрочной форме внутри аэрогриля. Так как точная модель и комплект аксессуаров владельца не подтверждены, в нашей версии курица готовится в корзине, а соус отдельно на плите. Не требуем неизвестную форму.
- **Куриные четверти:** подходят только если свободно помещаются в корзине. Если две четверти перекрывают поток воздуха, их надо разделить на бедро и голень или готовить партиями.
- **Кордон-блю и фаршированные грудки:** контроль температуры должен попадать в мясо, а не в расплавленный сыр или начинку.
- **Колбаски и кёфта:** фарш из птицы проверяется термометром, не по цвету корочки.

## Сверка с книгой Tefal

В книге Tefal Easy Fry & Grill нет прямых эквивалентов для этих десяти блюд. Режимы для крыльев, бёдер в йогурте или наггетсов не переносятся на фаршированные грудки, утку, кордон-блю, четверти и кёфта. Для карри также не предполагаем наличие глубокой формы, пока не подтверждена точная модель.

## Статусы

- 10 рецептов написаны и источниково проверены.
- У каждого есть отдельный фото-бриф, но все фото пока `not_started`.
- Физические испытания на конкретном аэрогриле не проводились.
- Все рецепты остаются `not_published`.
- Перед публикацией нужны уникальные WebP, проверка изображений, внедрение в обе HTML-версии, тесты поиска/списка покупок/режима готовки и desktop/mobile QA.

## Источники

1. [The Oregon Dietitian - Air Fryer Stuffed Chicken Breast](https://theoregondietitian.com/air-fryer-stuffed-chicken-breast/)
2. [Recipes Airfryer - Air Fryer Cornflake Turkey Medallions](https://recipesairfryer.net/crispy-medallions-in-air-fryer/)
3. [Muscle & Fitness - Cajun Turkey Medallions with Cranberry-Orange Sauce](https://www.muscleandfitness.com/nutrition/healthy-eating/low-fat-cajun-turkey-medallions-recipe/)
4. [Love Food Not Cooking - Crispy Air Fryer Duck Breast](https://lovefoodnotcooking.com/recipes/air-fryer-duck-breast/)
5. [Always Use Butter - Duck à l'Orange](https://alwaysusebutter.com/duck-a-lorange/)
6. [A Healthier Michigan - Air Fried Breaded Chicken Parmesan](https://www.ahealthiermichigan.org/stories/food-and-recipes/air-fried-breaded-chicken-parmesan)
7. [Samsung Food - Air Fryer Turkey Kofta](https://app.samsungfood.com/recipes/10701950022d47178c3ae17ac8d7e794da6)
8. [Schwartz UK - Air Fryer Chicken Curry](https://www.schwartz.co.uk/blogs/recipes/air-fryer-chicken-curry)
9. [Taste France - Air Fryer Chicken Cordon Bleu](https://www.tastefrance.com/us/recipes/french-classics/air-fryer-chicken-cordon-bleu)
10. [RTE - Kevin Dundon's Chicken Cordon Bleu in an Air Fryer](https://www.rte.ie/lifestyle/recipes/2023/1214/1420266-kevin-dundons-chicken-cordon-bleu-in-an-air-fryer/)
11. [Delish - Air Fryer Turkey Breakfast Sausage](https://www.delish.com/cooking/recipe-ideas/a39666473/air-fryer-turkey-breakfast-sausage-recipe/)
12. [The Real Food Dietitians - Turkey Sausage Patties with Apple](https://therealfooddietitians.com/turkey-apple-sausage-patties/)
13. [Samsung Food - Air Fryer Chicken Leg Quarters](https://app.samsungfood.com/recipes/1073bdce8d90066416a980863019881d254)
14. [AirFryersRecipe - Air Fryer Chicken Fajitas](https://airfryersrecipe.com/air-fryer-chicken-fajitas/)
15. [FoodSafety.gov - Safe Minimum Internal Temperatures](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures)


## Фото-приёмка 08.11.2026

- Файлы: 10/10 WebP технически проверены, размер 1200 × 900, SHA-256 сверены с записями фотобазы.
- Визуально принято: 8/10. На точечную перегенерацию: 2/10.
- Очередь замены: af-turkey-medallions-cranberry-2; af-turkey-sausages-apple-2.
- Все фотографии остаются неопубликованными. Физические испытания на точной модели аэрогриля владельца не заявлены.
