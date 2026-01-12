const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    // 查詢 chatbot 和相關的 tenant、plan
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: '1767688111182_dddqsliym' },
      include: {
        tenant: {
          include: {
            plan: true
          }
        }
      }
    });

    console.log('=== Chatbot 資訊 ===');
    console.log('ID:', chatbot?.id);
    console.log('TenantId:', chatbot?.tenantId);
    console.log('UserId:', chatbot?.userId);
    
    if (chatbot?.tenant) {
      console.log('\n=== Tenant 資訊 ===');
      console.log('Tenant ID:', chatbot.tenant.id);
      console.log('Plan Code:', chatbot.tenant.planCode);
      console.log('Status:', chatbot.tenant.status);
      
      console.log('\n=== Plan 資訊 ===');
      console.log('Name:', chatbot.tenant.plan.name);
      console.log('maxQueriesPerMo:', chatbot.tenant.plan.maxQueriesPerMo);
    }
    
    // 統計本月查詢次數
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const count = await prisma.queryLog.count({
      where: {
        chatbot: { tenantId: chatbot?.tenantId },
        createdAt: { gte: startOfMonth },
        ignored: false
      }
    });
    
    console.log('\n=== 本月查詢統計 ===');
    console.log('本月查詢次數:', count);
    console.log('配額限制:', chatbot?.tenant?.plan?.maxQueriesPerMo || 'NULL (無限制)');
    
    if (chatbot?.tenant?.plan?.maxQueriesPerMo) {
      const remaining = chatbot.tenant.plan.maxQueriesPerMo - count;
      console.log('剩餘次數:', remaining);
      
      if (count >= chatbot.tenant.plan.maxQueriesPerMo) {
        console.log('\n⚠️  已達到配額限制！');
      } else {
        console.log('\n✅ 尚未達到配額限制');
      }
    }
    
  } catch (error) {
    console.error('錯誤:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
