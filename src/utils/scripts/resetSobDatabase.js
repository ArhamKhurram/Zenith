require('dotenv').config();
const mongoose = require('mongoose');
const Sob = require('../../models/Sobs');

async function resetDatabase() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🔄 Dropping sobs collection...');
        await mongoose.connection.db.collection('sobs').drop().catch(() => {
            console.log('Collection doesn\'t exist, continuing...');
        });
        console.log('✅ Sobs collection dropped');

        console.log('🔄 Creating new collection with proper indexes...');
        // This will create the collection with the new schema and indexes
        const testSob = new Sob({
            reactorId: 'test',
            reactorUsername: 'test',
            targetUserId: 'test2',
            targetUsername: 'test2',
            messageId: 'test123',
            channelId: 'test',
            guildId: 'test'
        });
        await testSob.save();
        await Sob.deleteOne({ messageId: 'test123' });
        
        console.log('✅ Database reset complete!');
        console.log('📝 New indexes created:');
        const indexes = await Sob.collection.getIndexes();
        Object.keys(indexes).forEach(indexName => {
            console.log(`  - ${indexName}`);
        });

    } catch (error) {
        console.error('❌ Error resetting database:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

resetDatabase();
