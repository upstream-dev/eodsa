-- Nationals qualification data checks
-- Run against your staging/production DB to answer:
-- 1. Regional entries with Mastery Air/Earth and qualified_for_nationals = true
-- 2. Regional performances below 75% with qualified_for_nationals = true

-- 4.1 – Regional entries: Air or Earth with qualified_for_nationals = true
SELECT ee.id AS entry_id, ee.mastery, ee.qualified_for_nationals, ee.item_name, e.name AS event_name, e.event_type
FROM event_entries ee
JOIN events e ON e.id = ee.event_id
WHERE e.event_type = 'REGIONAL_EVENT'
  AND ee.qualified_for_nationals = true
  AND (ee.mastery ILIKE '%Air%' OR ee.mastery ILIKE '%Earth%');

-- 4.2 – Regional performances with published scores below 75% but entry qualified
SELECT ee.id AS entry_id, ee.qualified_for_nationals, ee.mastery, ee.item_name,
       p.id AS performance_id,
       AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) AS avg_total_score
FROM event_entries ee
JOIN events e ON e.id = ee.event_id
JOIN performances p ON p.event_entry_id = ee.id
JOIN scores s ON s.performance_id = p.id
WHERE e.event_type = 'REGIONAL_EVENT'
  AND p.scores_published = true
  AND ee.qualified_for_nationals = true
GROUP BY ee.id, ee.qualified_for_nationals, ee.mastery, ee.item_name, p.id
HAVING AVG(s.technical_score + s.musical_score + s.performance_score + s.styling_score + s.overall_impression_score) < 75;
