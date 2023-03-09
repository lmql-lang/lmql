import subprocess
import time
import asyncio
import sys
from tqdm import tqdm
import os
import termcolor

class Command:
    def __init__(self, line):
        self.cmd, info = line.split("#")
        self.title, time_estimate = info.split(", ")
        
        self.cmd = self.cmd.strip()
        self.title = self.title.strip()
        
        if time_estimate.endswith("s"):
            # time estimate in seconds
            self.time_estimate = int(time_estimate[:-1]) / 60
        else:
            assert time_estimate.endswith("m"), "Time estimate must be in minutes (e.g. 5m))"
            # time estimate in minutes
            self.time_estimate = int(time_estimate[:-1])
        
    async def run(self):
        env = os.environ.copy()
        env["PYTHONPATH"] = env.get("PYTHONPATH", "") + ":" + os.path.dirname(os.path.abspath(__file__)) + ":" + os.path.abspath(os.path.join(os.path.dirname(__file__), "../pldi"))
        
        return await (await asyncio.create_subprocess_shell(self.cmd, env=env)).communicate()

async def _run(commands):
    commands = [Command(line) for line in commands.splitlines() if line.strip() != "" and line.strip().startswith("#") == False]
    total_time = sum([c.time_estimate for c in commands]) * 60
    start_time = time.time()
    n = len(commands)
    # pbar = tqdm(total=total_time)
    cmd_start_time = time.time()
    
    # async def progress_reporter():
    #     while True:
    #         await asyncio.sleep(1)
            
    #         elapsed_time = (time.time() - start_time)
    #         elapsed_cmd_time = (time.time() - cmd_start_time)
    #         elapsed_time_without_current_cmd = elapsed_time - elapsed_cmd_time
    #         remaining_command_time = max(commands[0].time_estimate * 60, elapsed_cmd_time)
            
    #         pbar.total = int(sum(c.time_estimate for c in commands[1:])*60 + elapsed_time_without_current_cmd + remaining_command_time)
    #         pbar.set_description(f"Total Progress {n - len(commands)}/{n}")
            
    #         pbar.update(1)
            
            # print(f"[Progress, {(n-len(commands))/n:.2f}, Time elapsed: {(time.time() - start_time)/60:.4f}m]",end="\r", flush=True)
            
    # task = asyncio.create_task(progress_reporter())
    
    if len(commands) == 0:
        return
    
    print(termcolor.colored(f"Running {len(commands)} commands, total time estimate: {total_time} minutes", "green"))
    
    while len(commands) > 0:
        cmd_start_time = time.time()
        print(termcolor.colored(f"> {commands[0].cmd}", "green"), end="\n\n")
        
        # run the command
        await commands[0].run()
        
        time_elapsed = time.time() - cmd_start_time
        
        print(termcolor.colored(f"\n[Finished '{commands[0].title}' in {(time_elapsed/60.0):.2f}]", "green"), end="\n")
        commands = commands[1:]
        if len(commands) == 0:
            break
        
        remaining_time =  sum([c.time_estimate for c in commands])
        print(termcolor.colored(f"[{len(commands)}/{n} commands remaining. Estimated time remaining: {remaining_time:.2f} minutes]", "green"), end="\n\n")
        
    # task.cancel()

def run_list(commands):
    asyncio.run(_run(commands))