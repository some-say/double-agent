import { By, Key, until, WebDriver, WebElement } from 'selenium-webdriver';
import IDirective from '@double-agent/runner/interfaces/IDirective';

export default async function runDirectiveInWebDriver(
  driver: WebDriver,
  directive: IDirective,
  browserName: string,
) {
  const needsEnterKey = browserName == 'Safari';

  for (const page of directive.pages) {
    if (page.url !== (await driver.getCurrentUrl())) {
      console.log('Load page %s', page.url);
      await driver.get(page.url);
    }

    if (page.clickSelector) {
      console.log('Click element %s on %s', page.clickSelector, page.url);
      const elem = await waitForElement(driver, page.clickSelector);
      await driver.wait(until.elementIsVisible(elem));
      await clickElement(elem, needsEnterKey);
    }

    if (page.waitForElementSelector) {
      console.log('Wait for element %s on %s', page.waitForElementSelector, page.url);
      await waitForElement(driver, page.waitForElementSelector);
    }
  }
}

async function waitForElement(driver: WebDriver, cssSelector: string) {
  return driver.wait(until.elementLocated(By.css(cssSelector)));
}

async function clickElement(elem: WebElement, needsEnterKey: boolean) {
  if (needsEnterKey) {
    await elem.sendKeys(Key.RETURN);
  } else {
    await elem.click();
  }
}

export async function createNewWindow(driver: WebDriver) {
  console.log('Opening new window');
  await driver.executeScript('window.open()');
  await driver.close();
  const handles = await driver.getAllWindowHandles();
  await driver.switchTo().window(handles.pop());
}
