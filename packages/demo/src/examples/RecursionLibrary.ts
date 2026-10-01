// Every Recursion & Functions example below is written out the long way, the
// way a student would write it in C or Java: named FUNCTIONs with parameters,
// RETURN values, guard clauses, IF / ELSE IF / ELSE ladders, WHILE loops and
// recursive calls with a clear base case. Nothing is a one-line built-in, and
// nothing is hard-coded: change the numbers in DECLARE or the arguments in
// SEQUENCE and the run is still correct.
//
// Recursion is made visible in three ways:
//   * a "depth" parameter indents every line a call prints, so the console
//     shows who called whom (the deeper the call, the further to the right);
//   * a STACK named calls gets a PUSH when a call starts and a POP when it
//     returns, so the call stack grows and shrinks on screen;
//   * a counter array counts how many calls were made, so the cost of a
//     recursion (for example the naive Fibonacci) can be seen in numbers.
//
// Colour legend used across the examples:
//   HIGHLIGHT arr[i]              amber, only for the current step ("working on this cell")
//   HIGHLIGHT arr[i] 'SUCCESS'    green, stays ("done / the answer")
//   HIGHLIGHT arr[i] 'MARKED'     purple, stays ("chosen / waiting on the call stack")
//   HIGHLIGHT arr[i] 'DISCARDED'  grey, stays ("skipped / rejected")
//   HIGHLIGHT arr[i] 'NEUTRAL'    back to the normal blue
//
// Language facts the examples rely on (and teach):
//   * FUNCTIONs are declared in DECLARE and called from SEQUENCE (or from
//     other FUNCTIONs). A call is an expression: x = f(3), PRINT f(3), f(g(2)).
//   * Parameters are COPIES. Assigning to a parameter or to any name inside a
//     FUNCTION creates a local variable of that call only; the caller's
//     variables never change. Results go back with RETURN.
//   * A FUNCTION can READ a SEQUENCE variable, but cannot change it. The
//     arrays and stacks in DECLARE are shared: a FUNCTION can UPDATE, SWAP,
//     PUSH and POP them, and the caller sees the change. That is why shared
//     counters are kept in a one-cell array (UPDATE calls[0] calls[0] + 1).
//   * RETURN leaves the function immediately, also from inside a loop.
//   * LOOP k FROM 1 TO 0 counts DOWN and runs twice. When a count may be 0
//     (depth 0 means "no indentation"), use a WHILE loop.
//   * "/" is real division (7 / 2 = 3.5). Whole-number division by 2 is
//     written (n - n % 2) / 2, by 10 it is (n - n % 10) / 10.
//   * Text is joined with "+"; TEXT_LENGTH(s) and CHAR_AT(s, i) read text.
//   * A call that never reaches its base case stops with "Call stack exceeded
//     1000 frames": every recursion needs a base case that is always reached.

export const RecursionScripts = {
  // ── Functions ───────────────────────────────────────────────────────────────

  FunctionBasics: `SCENE FunctionBasics

DECLARE
  ARRAY price = [40, 25, 60, 50]
  ARRAY qty = [2, 4, 2, 4]

  FUNCTION lineTotal(i)
    total = price[i] * qty[i]
    RETURN total
  END

  FUNCTION discountOn(amount)
    IF amount >= 300
      RETURN amount * 10 / 100
    ELSE
      RETURN 0
    END
  END

  FUNCTION gstOn(amount)
    RETURN amount * 5 / 100
  END

  FUNCTION finalBill(subtotal)
    afterDiscount = subtotal - discountOn(subtotal)
    RETURN afterDiscount + gstOn(afterDiscount)
  END

SEQUENCE
  subtotal = 0
  LOOP i FROM 0 TO LENGTH(price) - 1
    HIGHLIGHT price[i]
    line = lineTotal(i)
    PRINT "Item " + i + ": " + qty[i] + " x " + price[i] + " = " + line
    subtotal = subtotal + line
    HIGHLIGHT price[i] 'SUCCESS'
  END

  PRINT "Subtotal: " + subtotal
  PRINT "Discount: " + discountOn(subtotal)
  PRINT "GST: " + gstOn(subtotal - discountOn(subtotal))
  PRINT "Amount to pay: " + finalBill(subtotal)

  PRINT "A bill of 120 pays " + finalBill(120) + " (no discount below 300)"
END
`,

  GradeCalculator: `SCENE GradeCalculator

DECLARE
  ARRAY marks = [91, 76, 105, 58, 34, 67, -3, 82]

  FUNCTION isValid(m)
    IF m < 0 OR m > 100
      RETURN FALSE
    END
    RETURN TRUE
  END

  FUNCTION gradeOf(m)
    IF m >= 90
      RETURN "A+"
    ELSE IF m >= 75
      RETURN "A"
    ELSE IF m >= 60
      RETURN "B"
    ELSE IF m >= 40
      RETURN "C"
    ELSE
      RETURN "F"
    END
  END

  FUNCTION remarkFor(grade)
    IF grade == "F"
      RETURN "needs a re-test"
    ELSE IF grade == "A+"
      RETURN "distinction"
    ELSE
      RETURN "pass"
    END
  END

SEQUENCE
  validCount = 0
  failCount = 0
  LOOP i FROM 0 TO LENGTH(marks) - 1
    HIGHLIGHT marks[i]
    IF isValid(marks[i]) == FALSE
      HIGHLIGHT marks[i] 'DISCARDED'
      PRINT "Student " + i + ": " + marks[i] + " is not a valid mark, skipped"
    ELSE
      grade = gradeOf(marks[i])
      PRINT "Student " + i + ": " + marks[i] + " -> grade " + grade + " (" + remarkFor(grade) + ")"
      validCount = validCount + 1
      IF grade == "F"
        failCount = failCount + 1
        HIGHLIGHT marks[i] 'MARKED'
      ELSE
        HIGHLIGHT marks[i] 'SUCCESS'
      END
    END
  END
  PRINT validCount + " valid marks, " + failCount + " student(s) need a re-test"
END
`,

  ParametersAreCopies: `SCENE ParametersAreCopies

DECLARE
  ARRAY score = [10, 20]

  FUNCTION trySwap(a, b)
    temp = a
    a = b
    b = temp
    PRINT "  inside trySwap: a=" + a + " b=" + b
  END

  FUNCTION swapCells(i, j)
    temp = score[i]
    UPDATE score[i] score[j]
    UPDATE score[j] temp
  END

  FUNCTION addBonus(points)
    points = points + 5
    RETURN points
  END

SEQUENCE
  x = 1
  y = 2
  trySwap(x, y)
  PRINT "after trySwap: x=" + x + " y=" + y + " (unchanged: the function got copies)"

  PRINT "before swapCells:" score
  swapCells(0, 1)
  PRINT "after swapCells:" score
  HIGHLIGHT score[0] 'SUCCESS'
  HIGHLIGHT score[1] 'SUCCESS'

  marksNow = 70
  addBonus(marksNow)
  PRINT "addBonus(marksNow) alone: marksNow is still " + marksNow
  marksNow = addBonus(marksNow)
  PRINT "marksNow = addBonus(marksNow): marksNow is now " + marksNow
END
`,

  LocalAndGlobalScope: `SCENE LocalAndGlobalScope

DECLARE
  ARRAY visitsBox = [0]

  FUNCTION greeting(name)
    RETURN shopName + " welcomes " + name
  END

  FUNCTION countVisitWrong()
    visits = visits + 1
    PRINT "  inside countVisitWrong: local visits = " + visits
  END

  FUNCTION nextCount(current)
    RETURN current + 1
  END

  FUNCTION countVisitInBox()
    UPDATE visitsBox[0] visitsBox[0] + 1
  END

SEQUENCE
  shopName = "Sharma Stores"
  visits = 0
  PRINT greeting("Asha")

  countVisitWrong()
  countVisitWrong()
  PRINT "after 2 wrong calls: visits = " + visits

  visits = nextCount(visits)
  visits = nextCount(visits)
  PRINT "after 2 nextCount calls: visits = " + visits

  countVisitInBox()
  countVisitInBox()
  countVisitInBox()
  HIGHLIGHT visitsBox[0] 'SUCCESS'
  PRINT "after 3 countVisitInBox calls: visitsBox[0] = " + visitsBox[0]
END
`,

  PrimeToolkit: `SCENE PrimeToolkit

DECLARE
  ARRAY nums = [2, 9, 13, 21, 29, 35, 41, 49]

  FUNCTION isPrime(n)
    IF n < 2
      RETURN FALSE
    END
    d = 2
    WHILE d * d <= n
      IF n % d == 0
        RETURN FALSE
      END
      d = d + 1
    END
    RETURN TRUE
  END

  FUNCTION smallestFactor(n)
    d = 2
    WHILE d * d <= n
      IF n % d == 0
        RETURN d
      END
      d = d + 1
    END
    RETURN n
  END

  FUNCTION nextPrimeAfter(n)
    candidate = n + 1
    WHILE isPrime(candidate) == FALSE
      candidate = candidate + 1
    END
    RETURN candidate
  END

  FUNCTION countPrimesUpTo(limit)
    count = 0
    k = 2
    WHILE k <= limit
      IF isPrime(k)
        count = count + 1
      END
      k = k + 1
    END
    RETURN count
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(nums) - 1
    HIGHLIGHT nums[i]
    IF isPrime(nums[i])
      HIGHLIGHT nums[i] 'SUCCESS'
      PRINT nums[i] + " is prime"
    ELSE
      HIGHLIGHT nums[i] 'DISCARDED'
      f = smallestFactor(nums[i])
      PRINT nums[i] + " = " + f + " x " + nums[i] / f + ", next prime is " + nextPrimeAfter(nums[i])
    END
  END
  PRINT "There are " + countPrimesUpTo(50) + " primes up to 50"
END
`,

  ClassReportFunctions: `SCENE ClassReportFunctions

DECLARE
  ARRAY marks = [68, 91, 45, 77, 83, 39, 73]

  FUNCTION sumOfMarks()
    total = 0
    LOOP i FROM 0 TO LENGTH(marks) - 1
      total = total + marks[i]
    END
    RETURN total
  END

  FUNCTION average()
    RETURN sumOfMarks() / LENGTH(marks)
  END

  FUNCTION indexOfMax()
    best = 0
    LOOP i FROM 1 TO LENGTH(marks) - 1
      IF marks[i] > marks[best]
        best = i
      END
    END
    RETURN best
  END

  FUNCTION indexOfMin()
    worst = 0
    LOOP i FROM 1 TO LENGTH(marks) - 1
      IF marks[i] < marks[worst]
        worst = i
      END
    END
    RETURN worst
  END

  FUNCTION countAtLeast(limit)
    count = 0
    LOOP i FROM 0 TO LENGTH(marks) - 1
      IF marks[i] >= limit
        count = count + 1
      END
    END
    RETURN count
  END

SEQUENCE
  PRINT "Total: " + sumOfMarks()
  avg = average()
  PRINT "Average: " + avg

  top = indexOfMax()
  low = indexOfMin()
  HIGHLIGHT marks[top] 'SUCCESS'
  HIGHLIGHT marks[low] 'DISCARDED'
  PRINT "Topper: student " + top + " with " + marks[top]
  PRINT "Lowest: student " + low + " with " + marks[low]

  PRINT countAtLeast(avg) + " students scored at least the average"
  PRINT countAtLeast(40) + " of " + LENGTH(marks) + " students passed (40 or more)"
END
`,

  AtmWithdrawal: `SCENE AtmWithdrawal

DECLARE
  ARRAY account = [5000, 0]
  ARRAY notes = [500, 200, 100]

  FUNCTION notesUsed(amount, note)
    RETURN (amount - amount % note) / note
  END

  FUNCTION printNotes(amount)
    left = amount
    LOOP i FROM 0 TO LENGTH(notes) - 1
      count = notesUsed(left, notes[i])
      IF count > 0
        PRINT "    " + count + " x " + notes[i]
      END
      left = left - count * notes[i]
    END
  END

  FUNCTION withdraw(amount)
    IF amount <= 0
      PRINT "Rs " + amount + ": rejected, amount must be positive"
      RETURN FALSE
    END
    IF amount % 100 != 0
      PRINT "Rs " + amount + ": rejected, the ATM only has notes of 100 and above"
      RETURN FALSE
    END
    IF amount > account[0]
      PRINT "Rs " + amount + ": rejected, balance is only " + account[0]
      RETURN FALSE
    END
    IF account[1] + amount > 4000
      PRINT "Rs " + amount + ": rejected, daily limit 4000 (already withdrawn " + account[1] + ")"
      RETURN FALSE
    END

    UPDATE account[0] account[0] - amount
    UPDATE account[1] account[1] + amount
    PRINT "Rs " + amount + ": dispensed, new balance " + account[0]
    printNotes(amount)
    RETURN TRUE
  END

SEQUENCE
  ok = 0
  IF withdraw(1800)
    ok = ok + 1
  END
  IF withdraw(-50)
    ok = ok + 1
  END
  IF withdraw(750)
    ok = ok + 1
  END
  IF withdraw(2500)
    ok = ok + 1
  END
  IF withdraw(2000)
    ok = ok + 1
  END
  IF withdraw(4000)
    ok = ok + 1
  END
  HIGHLIGHT account[0] 'SUCCESS'
  PRINT ok + " of 6 requests succeeded, final balance " + account[0]
END
`,

  // ── Recursion ───────────────────────────────────────────────────────────────

  FactorialRecursion: `SCENE FactorialRecursion

DECLARE
  STACK calls = []

  FUNCTION pad(depth)
    s = ""
    k = 0
    WHILE k < depth
      s = s + "  "
      k = k + 1
    END
    RETURN s
  END

  FUNCTION factorial(n, depth)
    PUSH calls n
    PRINT pad(depth) + "factorial(" + n + ") called"
    IF n <= 1
      PRINT pad(depth) + "base case: factorial(" + n + ") = 1"
      done = POP(calls)
      RETURN 1
    END
    smaller = factorial(n - 1, depth + 1)
    result = n * smaller
    PRINT pad(depth) + "factorial(" + n + ") = " + n + " * " + smaller + " = " + result
    done = POP(calls)
    RETURN result
  END

  FUNCTION factorialLoop(n)
    result = 1
    k = 2
    WHILE k <= n
      result = result * k
      k = k + 1
    END
    RETURN result
  END

SEQUENCE
  answer = factorial(5, 0)
  PRINT "factorial(5) = " + answer + ", the loop version gives " + factorialLoop(5)

  zero = factorial(0, 0)
  PRINT "factorial(0) = " + zero
END
`,

  HeadVsTailRecursion: `SCENE HeadVsTailRecursion

DECLARE
  ARRAY steps = [1, 2, 3, 4, 5]

  FUNCTION countDown(n)
    IF n == 0
      PRINT "Lift off!"
      RETURN 0
    END
    PRINT "countDown: " + n
    countDown(n - 1)
  END

  FUNCTION countUp(n)
    IF n == 0
      RETURN 0
    END
    countUp(n - 1)
    PRINT "countUp: " + n
  END

  FUNCTION paintBackwards(i)
    IF i >= LENGTH(steps)
      RETURN 0
    END
    paintBackwards(i + 1)
    HIGHLIGHT steps[i] 'SUCCESS'
    PRINT "painted index " + i
  END

SEQUENCE
  countDown(3)
  countUp(3)
  paintBackwards(0)
END
`,

  DigitRecursion: `SCENE DigitRecursion

DECLARE
  ARRAY numbers = [4072, 9, 123456, 99999]

  FUNCTION restOf(n)
    RETURN (n - n % 10) / 10
  END

  FUNCTION sumDigits(n)
    IF n < 10
      RETURN n
    END
    RETURN n % 10 + sumDigits(restOf(n))
  END

  FUNCTION countDigits(n)
    IF n < 10
      RETURN 1
    END
    RETURN 1 + countDigits(restOf(n))
  END

  FUNCTION reverseDigits(n, built)
    IF n == 0
      RETURN built
    END
    RETURN reverseDigits(restOf(n), built * 10 + n % 10)
  END

  FUNCTION digitalRoot(n)
    IF n < 10
      RETURN n
    END
    RETURN digitalRoot(sumDigits(n))
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(numbers) - 1
    n = numbers[i]
    HIGHLIGHT numbers[i]
    PRINT n + ": " + countDigits(n) + " digits, digit sum " + sumDigits(n) + ", reversed " + reverseDigits(n, 0) + ", digital root " + digitalRoot(n)
    HIGHLIGHT numbers[i] 'SUCCESS'
  END
END
`,

  PowerRecursion: `SCENE PowerRecursion

DECLARE
  ARRAY callCount = [0, 0]

  FUNCTION slowPower(b, e)
    UPDATE callCount[0] callCount[0] + 1
    IF e == 0
      RETURN 1
    END
    RETURN b * slowPower(b, e - 1)
  END

  FUNCTION fastPower(b, e)
    UPDATE callCount[1] callCount[1] + 1
    IF e == 0
      RETURN 1
    END
    half = fastPower(b, (e - e % 2) / 2)
    IF e % 2 == 0
      RETURN half * half
    ELSE
      RETURN b * half * half
    END
  END

SEQUENCE
  PRINT "2^10 = " + slowPower(2, 10) + " with " + callCount[0] + " calls"
  PRINT "2^10 = " + fastPower(2, 10) + " with " + callCount[1] + " calls"

  UPDATE callCount[0] 0
  UPDATE callCount[1] 0
  a = slowPower(3, 13)
  b = fastPower(3, 13)
  PRINT "3^13 = " + a + " (slow: " + callCount[0] + " calls) = " + b + " (fast: " + callCount[1] + " calls)"
  PRINT "Any number to the power 0 is " + fastPower(7, 0)
  HIGHLIGHT callCount[1] 'SUCCESS'
END
`,

  GcdAndLcm: `SCENE GcdAndLcm

DECLARE
  STACK calls = []

  FUNCTION pad(depth)
    s = ""
    k = 0
    WHILE k < depth
      s = s + "  "
      k = k + 1
    END
    RETURN s
  END

  FUNCTION gcd(a, b, depth)
    PUSH calls b
    PRINT pad(depth) + "gcd(" + a + ", " + b + ")"
    IF b == 0
      done = POP(calls)
      RETURN a
    END
    answer = gcd(b, a % b, depth + 1)
    done = POP(calls)
    RETURN answer
  END

  FUNCTION lcm(a, b)
    RETURN a / gcd(a, b, 0) * b
  END

SEQUENCE
  side = gcd(48, 18, 0)
  PRINT "Biggest square tile: " + side + " x " + side + " feet, " + (48 / side) * (18 / side) + " tiles"

  g = gcd(84, 126, 0)
  PRINT "84/126 = " + 84 / g + "/" + 126 / g

  PRINT "The buses meet again after " + lcm(12, 18) + " minutes"

  PRINT "gcd(17, 5) = " + gcd(17, 5, 0) + ", so 17 and 5 share no factor"
END
`,

  FibonacciThreeWays: `SCENE FibonacciThreeWays

DECLARE
  ARRAY memo = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
  ARRAY calls = [0, 0]

  FUNCTION fibNaive(n)
    UPDATE calls[0] calls[0] + 1
    IF n <= 1
      RETURN n
    END
    RETURN fibNaive(n - 1) + fibNaive(n - 2)
  END

  FUNCTION fibMemo(n)
    UPDATE calls[1] calls[1] + 1
    IF memo[n] != -1
      RETURN memo[n]
    END
    value = n
    IF n > 1
      value = fibMemo(n - 1) + fibMemo(n - 2)
    END
    UPDATE memo[n] value
    HIGHLIGHT memo[n] 'SUCCESS'
    RETURN value
  END

  FUNCTION fibLoop(n)
    IF n <= 1
      RETURN n
    END
    prev = 0
    curr = 1
    k = 2
    WHILE k <= n
      next = prev + curr
      prev = curr
      curr = next
      k = k + 1
    END
    RETURN curr
  END

SEQUENCE
  LOOP n FROM 5 TO 15
    UPDATE calls[0] 0
    value = fibNaive(n)
    IF n % 5 == 0
      PRINT "naive fib(" + n + ") = " + value + " needed " + calls[0] + " calls"
    END
  END

  UPDATE calls[1] 0
  PRINT "memo fib(16) = " + fibMemo(16) + " needed " + calls[1] + " calls"
  UPDATE calls[1] 0
  again = fibMemo(16)
  PRINT "asking for fib(16) again: " + again + " in " + calls[1] + " call (a table lookup)"
  PRINT "loop fib(16) = " + fibLoop(16)
END
`,

  ArrayRecursion: `SCENE ArrayRecursion

DECLARE
  ARRAY temps = [31, 28, 35, 33, 29, 36, 32]

  FUNCTION sumFrom(i)
    IF i == LENGTH(temps)
      RETURN 0
    END
    HIGHLIGHT temps[i]
    RETURN temps[i] + sumFrom(i + 1)
  END

  FUNCTION maxIndexFrom(i)
    IF i == LENGTH(temps) - 1
      RETURN i
    END
    bestOfRest = maxIndexFrom(i + 1)
    IF temps[i] >= temps[bestOfRest]
      RETURN i
    END
    RETURN bestOfRest
  END

  FUNCTION countAbove(i, limit)
    IF i == LENGTH(temps)
      RETURN 0
    END
    IF temps[i] > limit
      RETURN 1 + countAbove(i + 1, limit)
    END
    RETURN countAbove(i + 1, limit)
  END

  FUNCTION isSortedFrom(i)
    IF i >= LENGTH(temps) - 1
      RETURN TRUE
    END
    IF temps[i] > temps[i + 1]
      RETURN FALSE
    END
    RETURN isSortedFrom(i + 1)
  END

SEQUENCE
  total = sumFrom(0)
  PRINT "Total of " + LENGTH(temps) + " days: " + total + ", average " + total / LENGTH(temps)
  hottest = maxIndexFrom(0)
  HIGHLIGHT temps[hottest] 'SUCCESS'
  PRINT "Hottest day: index " + hottest + " at " + temps[hottest] + " degrees"
  PRINT countAbove(0, 32) + " days were above 32 degrees"
  PRINT "Sorted? " + isSortedFrom(0)
END
`,

  ReverseArrayRecursive: `SCENE ReverseArrayRecursive

DECLARE
  ARRAY playlist = [101, 102, 103, 104, 105, 106, 107]

  FUNCTION reverseRange(left, right)
    IF left >= right
      IF left == right
        HIGHLIGHT playlist[left] 'SUCCESS'
      END
      RETURN 0
    END
    HIGHLIGHT playlist[left] 'MARKED'
    HIGHLIGHT playlist[right] 'MARKED'
    SWAP playlist[left] playlist[right]
    HIGHLIGHT playlist[left] 'SUCCESS'
    HIGHLIGHT playlist[right] 'SUCCESS'
    RETURN 1 + reverseRange(left + 1, right - 1)
  END

SEQUENCE
  PRINT "Before:" playlist
  swaps = reverseRange(0, LENGTH(playlist) - 1)
  PRINT "After:" playlist
  PRINT swaps + " swaps for " + LENGTH(playlist) + " songs"
END
`,

  PalindromeRecursion: `SCENE PalindromeRecursion

DECLARE
  ARRAY words = ["racecar", "level", "abba", "hello", "madam", "x", "radar", "rotor", "ranker"]

  FUNCTION isPalindrome(word, left, right)
    IF left >= right
      RETURN TRUE
    END
    IF CHAR_AT(word, left) != CHAR_AT(word, right)
      PRINT "  " + word + ": '" + CHAR_AT(word, left) + "' at " + left + " differs from '" + CHAR_AT(word, right) + "' at " + right
      RETURN FALSE
    END
    RETURN isPalindrome(word, left + 1, right - 1)
  END

  FUNCTION reversed(word, i)
    IF i < 0
      RETURN ""
    END
    RETURN CHAR_AT(word, i) + reversed(word, i - 1)
  END

SEQUENCE
  found = 0
  LOOP i FROM 0 TO LENGTH(words) - 1
    w = words[i]
    HIGHLIGHT words[i]
    IF isPalindrome(w, 0, TEXT_LENGTH(w) - 1)
      found = found + 1
      HIGHLIGHT words[i] 'SUCCESS'
      PRINT w + " is a palindrome"
    ELSE
      HIGHLIGHT words[i] 'DISCARDED'
      PRINT w + " is not a palindrome (reversed: " + reversed(w, TEXT_LENGTH(w) - 1) + ")"
    END
  END
  PRINT found + " of " + LENGTH(words) + " words are palindromes"
END
`,

  NumberBases: `SCENE NumberBases

DECLARE
  ARRAY values = [13, 255, 100, 0]

  FUNCTION half(n)
    RETURN (n - n % 2) / 2
  END

  FUNCTION toBinary(n)
    IF n < 2
      RETURN "" + n
    END
    RETURN toBinary(half(n)) + n % 2
  END

  FUNCTION toBase(n, base)
    digits = "0123456789ABCDEF"
    last = n % base
    IF n < base
      RETURN CHAR_AT(digits, last)
    END
    RETURN toBase((n - last) / base, base) + CHAR_AT(digits, last)
  END

  FUNCTION onesIn(n)
    IF n == 0
      RETURN 0
    END
    RETURN n % 2 + onesIn(half(n))
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(values) - 1
    n = values[i]
    HIGHLIGHT values[i]
    PRINT n + " -> binary " + toBinary(n) + ", octal " + toBase(n, 8) + ", hex " + toBase(n, 16) + ", " + onesIn(n) + " one-bit(s)"
    HIGHLIGHT values[i] 'SUCCESS'
  END
END
`,

  MutualRecursion: `SCENE MutualRecursion

DECLARE
  ARRAY nums = [0, 7, 10, 15, 22]

  FUNCTION isEven(n)
    IF n == 0
      RETURN TRUE
    END
    RETURN isOdd(n - 1)
  END

  FUNCTION isOdd(n)
    IF n == 0
      RETURN FALSE
    END
    RETURN isEven(n - 1)
  END

  FUNCTION collatzSteps(n)
    IF n == 1
      RETURN 0
    END
    IF isEven(n)
      RETURN 1 + collatzSteps(n / 2)
    END
    RETURN 1 + collatzSteps(3 * n + 1)
  END

SEQUENCE
  LOOP i FROM 0 TO LENGTH(nums) - 1
    HIGHLIGHT nums[i]
    IF isEven(nums[i])
      HIGHLIGHT nums[i] 'SUCCESS'
      PRINT nums[i] + " is even"
    ELSE
      HIGHLIGHT nums[i] 'MARKED'
      PRINT nums[i] + " is odd"
    END
  END
  PRINT "Collatz: 6 reaches 1 in " + collatzSteps(6) + " steps, 7 in " + collatzSteps(7) + " steps"
END
`,

  TowerOfHanoi: `SCENE TowerOfHanoi

DECLARE
  STACK pegA = [3, 2, 1]
  STACK pegB = []
  STACK pegC = []
  ARRAY moveCount = [0]

  FUNCTION nameOf(peg)
    IF peg == 1
      RETURN "A"
    ELSE IF peg == 2
      RETURN "B"
    ELSE
      RETURN "C"
    END
  END

  FUNCTION takeFrom(peg)
    IF peg == 1
      RETURN POP(pegA)
    ELSE IF peg == 2
      RETURN POP(pegB)
    ELSE
      RETURN POP(pegC)
    END
  END

  FUNCTION putOn(peg, disk)
    IF peg == 1
      PUSH pegA disk
    ELSE IF peg == 2
      PUSH pegB disk
    ELSE
      PUSH pegC disk
    END
  END

  FUNCTION moveDisk(src, dst)
    disk = takeFrom(src)
    putOn(dst, disk)
    UPDATE moveCount[0] moveCount[0] + 1
    PRINT "Move " + moveCount[0] + ": disk " + disk + " from " + nameOf(src) + " to " + nameOf(dst)
  END

  FUNCTION hanoi(n, src, dst, spare)
    IF n == 0
      RETURN 0
    END
    hanoi(n - 1, src, spare, dst)
    moveDisk(src, dst)
    hanoi(n - 1, spare, dst, src)
  END

SEQUENCE
  disks = LENGTH(pegA)
  hanoi(disks, 1, 3, 2)
  PRINT "Peg C (bottom to top):" pegC
  PRINT disks + " disks moved in " + moveCount[0] + " moves (2^n - 1)"
END
`,

  SubsetsWithinBudget: `SCENE SubsetsWithinBudget

DECLARE
  ARRAY cost = [40, 30, 50, 20]
  ARRAY chosen = [0, 0, 0, 0]
  ARRAY counts = [0, 0]

  FUNCTION describe()
    text = ""
    total = 0
    LOOP k FROM 0 TO LENGTH(cost) - 1
      IF chosen[k] == 1
        text = text + cost[k] + " "
        total = total + cost[k]
      END
    END
    IF total == 0
      RETURN "plain pizza (0)"
    END
    RETURN text + "(" + total + ")"
  END

  FUNCTION explore(i, spent, budget)
    IF spent > budget
      RETURN 0
    END
    IF i == LENGTH(cost)
      UPDATE counts[0] counts[0] + 1
      PRINT "  " + describe()
      RETURN 0
    END
    explore(i + 1, spent, budget)
    UPDATE chosen[i] 1
    HIGHLIGHT cost[i] 'MARKED'
    explore(i + 1, spent + cost[i], budget)
    UPDATE chosen[i] 0
    HIGHLIGHT cost[i] 'NEUTRAL'
  END

SEQUENCE
  PRINT "Topping combinations within 100:"
  explore(0, 0, 100)
  PRINT counts[0] + " combinations fit the budget (out of 2^" + LENGTH(cost) + " = 16)"
  PRINT "chosen is back to all zeros:" chosen
END
`,

  SeatingPermutations: `SCENE SeatingPermutations

DECLARE
  ARRAY seat = ["Asha", "Ben", "Chen"]
  ARRAY found = [0]

  FUNCTION line()
    text = ""
    LOOP k FROM 0 TO LENGTH(seat) - 1
      text = text + seat[k] + " "
    END
    RETURN text
  END

  FUNCTION arrange(pos)
    IF pos == LENGTH(seat) - 1
      UPDATE found[0] found[0] + 1
      PRINT found[0] + ": " + line()
      RETURN 0
    END
    k = pos
    WHILE k < LENGTH(seat)
      SWAP seat[pos] seat[k]
      HIGHLIGHT seat[pos] 'MARKED'
      arrange(pos + 1)
      SWAP seat[pos] seat[k]
      HIGHLIGHT seat[pos] 'NEUTRAL'
      k = k + 1
    END
  END

  FUNCTION factorial(n)
    IF n <= 1
      RETURN 1
    END
    RETURN n * factorial(n - 1)
  END

SEQUENCE
  arrange(0)
  PRINT found[0] + " arrangements = " + LENGTH(seat) + "! = " + factorial(LENGTH(seat))
  PRINT "Seats restored:" seat
END
`,

  NQueens: `SCENE NQueens

DECLARE
  ARRAY col = [-1, -1, -1, -1]
  ARRAY solutions = [0]

  FUNCTION diff(a, b)
    IF a > b
      RETURN a - b
    END
    RETURN b - a
  END

  FUNCTION isSafe(row, c)
    r = 0
    WHILE r < row
      IF col[r] == c OR diff(col[r], c) == row - r
        RETURN FALSE
      END
      r = r + 1
    END
    RETURN TRUE
  END

  FUNCTION boardRow(r)
    text = ""
    LOOP c FROM 0 TO LENGTH(col) - 1
      IF col[r] == c
        text = text + "Q "
      ELSE
        text = text + ". "
      END
    END
    RETURN text
  END

  FUNCTION place(row)
    n = LENGTH(col)
    IF row == n
      UPDATE solutions[0] solutions[0] + 1
      PRINT "Solution " + solutions[0] + ":"
      LOOP r FROM 0 TO n - 1
        PRINT "  " + boardRow(r)
      END
      RETURN 0
    END
    c = 0
    WHILE c < n
      IF isSafe(row, c)
        UPDATE col[row] c
        HIGHLIGHT col[row] 'SUCCESS'
        place(row + 1)
        UPDATE col[row] -1
        HIGHLIGHT col[row] 'NEUTRAL'
      END
      c = c + 1
    END
  END

SEQUENCE
  place(0)
  PRINT LENGTH(col) + " queens can be placed in " + solutions[0] + " ways"
END
`,

  ClimbingStairs: `SCENE ClimbingStairs

DECLARE
  ARRAY ways = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]

  FUNCTION countWays(n)
    IF ways[n] != -1
      RETURN ways[n]
    END
    answer = 1
    IF n > 1
      answer = countWays(n - 1) + countWays(n - 2)
    END
    UPDATE ways[n] answer
    HIGHLIGHT ways[n] 'SUCCESS'
    RETURN answer
  END

  FUNCTION listWays(left, soFar)
    IF left == 0
      PRINT "  " + soFar
      RETURN 1
    END
    total = 0
    IF left >= 1
      IF soFar == ""
        total = total + listWays(left - 1, "1")
      ELSE
        total = total + listWays(left - 1, soFar + "+1")
      END
    END
    IF left >= 2
      IF soFar == ""
        total = total + listWays(left - 2, "2")
      ELSE
        total = total + listWays(left - 2, soFar + "+2")
      END
    END
    RETURN total
  END

SEQUENCE
  PRINT "All ways to climb 4 steps:"
  listed = listWays(4, "")
  PRINT listed + " ways for 4 steps, countWays(4) = " + countWays(4)
  PRINT "A staircase of 10 steps: " + countWays(10) + " ways"
END
`,

  CoinChangeWays: `SCENE CoinChangeWays

DECLARE
  ARRAY coins = [1, 2, 5, 10]
  ARRAY calls = [0]
  ARRAY fewest = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]

  FUNCTION ways(amount, i)
    UPDATE calls[0] calls[0] + 1
    IF amount == 0
      RETURN 1
    END
    IF amount < 0 OR i == LENGTH(coins)
      RETURN 0
    END
    RETURN ways(amount - coins[i], i) + ways(amount, i + 1)
  END

  FUNCTION fewestCoins(amount)
    IF fewest[amount] != -1
      RETURN fewest[amount]
    END
    best = 0
    IF amount > 0
      best = INFINITY
      LOOP k FROM 0 TO LENGTH(coins) - 1
        IF coins[k] <= amount
          tryCount = 1 + fewestCoins(amount - coins[k])
          IF tryCount < best
            best = tryCount
          END
        END
      END
    END
    UPDATE fewest[amount] best
    HIGHLIGHT fewest[amount] 'SUCCESS'
    RETURN best
  END

  FUNCTION coinsUsed(amount)
    IF amount == 0
      RETURN ""
    END
    k = LENGTH(coins) - 1
    WHILE k >= 0
      c = coins[k]
      IF c <= amount
        IF fewest[amount - c] == fewest[amount] - 1
          RETURN c + " " + coinsUsed(amount - c)
        END
      END
      k = k - 1
    END
    RETURN ""
  END

SEQUENCE
  PRINT "Ways to pay 5: " + ways(5, 0) + " (" + calls[0] + " calls)"
  UPDATE calls[0] 0
  PRINT "Ways to pay 12: " + ways(12, 0) + " (" + calls[0] + " calls)"
  PRINT "Fewest coins for 18: " + fewestCoins(18) + " -> " + coinsUsed(18)
END
`,
};
