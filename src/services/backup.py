import asyncio
import subprocess
import aiohttp
from ..config import settings



async def send_backup():
    # dump to disk
    DUMP_PATH = "/root/LexiGO/backup.sql"
    with open(DUMP_PATH, "w") as f:
        proc = await asyncio.create_subprocess_exec(
            "mysqldump", "-u", settings.DB_USER, f"-p{settings.DB_PASSWORD}",
            "-h", settings.DB_HOST, settings.DB_NAME,
            stdout=f,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await proc.communicate()

    if proc.returncode != 0:
        print(f"Dump failed: {stderr.decode()}")
        return

    # send to telegram
    url = f"https://api.telegram.org/bot{settings.BACKUP_TOKEN.get_secret_value()}/sendDocument"
    async with aiohttp.ClientSession() as session:
        with open(DUMP_PATH, "rb") as f:
            data = aiohttp.FormData()
            data.add_field("chat_id", str(settings.ADMIN_ID))
            data.add_field("caption", "🗄 Scheduled Database Backup")
            data.add_field("document", f, filename="lexigo_backup.sql")
            async with session.post(url, data=data) as resp:
                print(await resp.json())

    # delete after sending
    import os
    os.remove(DUMP_PATH)
    print("Backup sent and file deleted.")


asyncio.run(send_backup())