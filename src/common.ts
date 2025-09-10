import { GroupDTOS } from "./dtos/groups.dtos";
import { SponsorDTOS } from "./dtos/sponsor.dtos";
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';


let allowedGroupIds: GroupDTOS[] = []
let sponsorDtos: SponsorDTOS[] = []


async function countLinesInFile(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const fileStream = createReadStream(filePath, { encoding: 'utf8' });
    let lineCount = 0;

    fileStream.on('data', (chunk: string | Buffer) => {
      const data = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      lineCount += data.split('\n').length - 1;
    });

    fileStream.on('end', () => {
      resolve(lineCount);
    });

    fileStream.on('error', (err) => {
      reject(err);
    });
  });
}

async function generateMetricsSummary(logFilePath: string, totalMemberCount: number): Promise<{
  groupName: string;
  totalMemberCount: number;
  totalMessages: number;
  activeUserCount: number;
  activityScore: number;
}> {
  try {
    const content = await fs.readFile(logFilePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim().length > 0);

    const messageCount: Record<string, number> = {};
    let totalMessages = 0;

    for (const line of lines) {
      if (/joined group|left group/i.test(line)) continue;

      const match = line.match(/^\[.*?\] \[.*?\] (.*?): /);
      if (match) {
        const username = match[1];
        totalMessages++;
        messageCount[username] = (messageCount[username] || 0) + 1;
      }
    }

    const activeUserCount = Object.keys(messageCount).length;

    const groupNameMatch = lines[0]?.match(/\[.*?\] \[(.*?)\]/);
    const groupName = groupNameMatch ? groupNameMatch[1] : 'Unknown Group';

    const activityRatio = totalMemberCount > 0 ? activeUserCount / totalMemberCount : 0;
    const messagesPerUser = activeUserCount > 0 ? totalMessages / activeUserCount : 0;

    let activityScore = 1;
    if (activityRatio > 0.7 && messagesPerUser > 10) activityScore = 10;
    else if (activityRatio > 0.5) activityScore = 8;
    else if (activityRatio > 0.3) activityScore = 6;
    else if (activityRatio > 0.1) activityScore = 4;
    else if (activityRatio > 0.05) activityScore = 2;
    else activityScore = 1;

    return {
      groupName,
      totalMemberCount,
      totalMessages,
      activeUserCount,
      activityScore
    };

  } catch (err) {
    console.error(`❌ Failed to process file ${logFilePath}:`, err);
    return {
      groupName: 'Error',
      totalMemberCount: 0,
      totalMessages: 0,
      activeUserCount: 0,
      activityScore: 0
    };
  }
}


export { allowedGroupIds, sponsorDtos, countLinesInFile, generateMetricsSummary };