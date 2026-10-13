import os
import requests
import time


def ping_url(url, delay, max_trials):
    trials = 0

    while trials < max_trials:
        try:
            response = requests.get(url)
            if response.status_code == 200:
                print(f"Website {url} is reachable.")
                return True
        except requests.ConnectionError:
            print(f"Website {url} is not reachable. Retrying in {delay} seconds...")
            time.sleep(delay)
            trials += 1
        except requests.exceptions.MissingSchema:
            print(f"Invalid URL: {url}. Please provide a valid URL.")
            return False

    return False

def run():
    url = os.environ.get("INPUT_URL")
    max_trials = int(os.environ.get("INPUT_MAX_TRIALS"))
    delay = int(os.environ.get("INPUT_DELAY"))
    
    website_reachable = ping_url(url, delay, max_trials)

    if not website_reachable:
        raise Exception(f"Website {url} is not reachable after {max_trials} trials.")

    print(f"Website {url} is reachable after {max_trials} trials.")


if __name__ == "__main__":
    run()
