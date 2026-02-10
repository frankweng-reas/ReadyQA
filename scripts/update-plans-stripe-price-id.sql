-- 更新 plans 表的 stripePriceId
-- 請將環境變數中的 Price ID 填入對應的方案

-- Starter 方案
UPDATE plans 
SET "stripePriceId" = 'price_1Sy31ZK9AZTayzSGRTAAnraV' 
WHERE code = 'starter';

-- Pro 方案
UPDATE plans 
SET "stripePriceId" = 'price_1Sy3MbK9AZTayzSGFi27yW0O' 
WHERE code = 'pro';

-- Enterprise 方案
UPDATE plans 
SET "stripePriceId" = 'price_1Sy3WRK9AZTayzSGV0TlB2VF' 
WHERE code = 'enterprise';

-- 查詢結果確認
SELECT code, name, "stripePriceId" FROM plans ORDER BY code;
