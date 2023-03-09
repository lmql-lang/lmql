import asyncio

async def fulfill_futs(futs):
    i = 0

    while True:
        if len(futs) == 0: break
        
        f = futs[-1]
        f.set_result(i)
        i += 1
        
        futs = futs[:-1]
        
        await asyncio.sleep(0.2)

async def main():
    # Get the current event loop.
    loop = asyncio.get_running_loop()

    futs = [loop.create_future() for i in range(10)]

    loop.create_task(fulfill_futs(futs))

    # wait for all futs
    for f in futs:
        print(await f)


asyncio.run(main())